const nodeocc = require("node-occ");
const assert = require("assert");
const _ = require("underscore");
const geometry_editor = require("node-occ-csg-editor");
const GeomTransfoBatch = geometry_editor.GeomTransfoBatch;
const occ = nodeocc.occ;
const shapeFactory = nodeocc.shapeFactory;
const scriptRunner = nodeocc.scriptRunner;
const fast_occ = nodeocc.fastBuilder.occ;
const chalk = require("chalk");
const doDebug = false;

function buildResponse(cacheBefore, data, logs) {

    assert(data instanceof Array);

    const displayCache = {};
    const meshes = {};

    let response = {solids: [], logs: []};
    let counter = 1;
    data.forEach(function (dataItem) {

        if (dataItem.err) {

            displayCache[dataItem.id] = {err: dataItem.err.message};

        } else {

            const shape = dataItem.shape;

            if (cacheBefore[shape._id] && cacheBefore[shape._id].hash === shape.uuid) {
                // object has not changed, and is already on client side
                displayCache[dataItem.id] = {hash: shape.uuid, err: null};
                meshes[dataItem.id] = {mesh: "reuse"};
                return;
            }

            assert(shape._id);
            counter++;
            try {
                shape.name = "id_" + shape._id;
                let mesh = occ.buildSolidMesh(shape);
                displayCache[dataItem.id] = {hash: shape.uuid, err: null};
                meshes[dataItem.id] = {mesh: mesh};

            }
            catch (err) {
                //Xx console.log(" meshing shape  ", shape._id ," has failed with error ",err.message);
                displayCache[dataItem.id] = {hash: shape.uuid, err: err.message};
                meshes[dataItem.id] = {mesh: null};
            }

        }

    });
    response.logs = logs;
    response.displayCache = displayCache;
    response.meshes = meshes;


    response.solids = data.map(x => {
        if (x.shape) {
            return {
                '_id': x.shape._id,
                'uuid': x.shape.uuid,
                'name': x.shape.name,
                'area': x.shape.area,
                'volume': x.shape.volume
            };
        }
    });

    return response;
}


function getName(item) {
    // const GeomPrimitiveObject = geometry_editor.GeomPrimitiveObject;
    // if (item instanceof GeomPrimitiveObject)
    if (item.geometries && item.geometries.length > 0) {
        const name = (item.geometries.map(x => x.name)).join("U");
        return name;
    }
    return item.name;
}

function createDisplayString(item, context) {

    if (item.origin.geometryName != "" && item.origin.libName != "") {
        const name = getName(item);
        let str = "var " + name + ";\n";
        str += "try {\n";
        str += "    " + name + " = " + item.toScript(context) + "\n";
        if (item.isVisible) {
            str += "    display(" + name + ",\"" + item._id + "\");\n";
        }
        str += "} catch(err) {\n";
        str += `   console.log("building ${name} with id ${item._id} has failed");\n`;
        str += `   console.log(" err = " + err.message);\n`;
        str += "   reportError(err,\"" + item._id + "\");\n";
        str += "}\n";


        //
        if (item.parameters)
        {
            item.parameters = item.parameters.filter(k => !!k);
            let paramIdRootNames = [];

            item.parameters = item.parameters.sort(function (a, b) {
                // ASC  -> a.length - b.length
                // DESC -> b.length - a.length
                return b.id.length - a.id.length;
            });


            item.parameters.forEach(param => {
                if (param) {
                    var find = param.id.split("_" + item.origin.geometryName + "_" + item.origin.libName)[0];
                    paramIdRootNames.push(find);
                    let re = new RegExp(find+"(?![[:alnum:]]|[a-zA-Z]*_)", 'g');
                    str = str.replace(re, param.id);
                }
            });

        }

        return str;
    }
    else {
        const name = getName(item);
        let str = "var " + name + ";\n";
        str += "try {\n";
        str += "    " + name + " = " + item.toScript(context) + "\n";
        if (item.isVisible) {
            str += "    display(" + name + ",\"" + item._id + "\");\n";
        }
        str += "} catch(err) {\n";
        str += `   console.log("building ${name} with id ${item._id} has failed");\n`;
        str += `   console.log(" err = " + err.message);\n`;
        str += "   reportError(err,\"" + item._id + "\");\n";
        str += "}\n";

        return str;
    }

}

function createDisplayStringForConnectors(localItem, isVisible, name, context) {
    let str = "";
    const nbOfConnectors = localItem.getWidgetConnectors().length;
    for (var l = 0; l < nbOfConnectors; l++) {
        if (localItem.getWidgetConnectors()[l]._linked.name == name && isVisible) {
            localItem.getWidgetConnectors()[l]._linked.isVisible = true;
        }
        else {
            localItem.getWidgetConnectors()[l]._linked.isVisible = false;
        }
        str = createDisplayString(localItem.getWidgetConnectors()[l]._linked, context) + str;

        if (localItem.getWidgetConnectors()[l]._linked) {
            str = createDisplayStringForConnectors(localItem.getWidgetConnectors()[l]._linked, isVisible, name, context) + str;
        }
    }

    return str;
}


function overrideParametersName(localItem, str) {
    // if (!localItem.parameters) return "";

    if (!localItem) return "";
    if (!localItem.parameters) return "";


    const lgth = localItem.parameters.length;

    for (let i = 0; i < lgth; i++) {
        const param = localItem.parameters[i];
        var find = param.id.split("_" + localItem.name + "_" + localItem.geometriesLibGUID)[0];
        let re = new RegExp(find, 'g');
        str = str.replace(re, param.id);
    }
    return str;
}


function convertToScriptEx(geometryEditor) {

    const context = {};

    function convertItemToScript(item) {

        let str = "";

        // First define intermediate dependancies shapes for an eventuel following compound object
        if (!!item.geometries) {
            for (var j = 0; j < item.geometries.length; j++) {
                let localItem = item.geometries[j];
                str = createDisplayStringForConnectors(localItem, item.isVisible, item.name, context) + str;
            }
            str += createDisplayString(item, context);
            str = overrideParametersName(item.geometries[0], str);
        }
        else {
            // Then create a simple shape or a compound Object
            str += createDisplayString(item, context);
            // if (item.additionalSource) {
            //     str += createDisplayString(item.additionalSource, context);
            // }
        }

        return str;
    }

    function convertParameterToScript(item) {
        if (!item) {
            return;
        }
        if (!item.geometries) {
            const value = (item.value === null || item.value === undefined) ? item.defaultValue : item.value;
            return "var $" + item.id + " = " + value + ";"
        }
        const parameters = item.parameters;

        let stringToReturn = "";
        parameters.forEach(param => {
            const value = (param.value === null || param.value === undefined) ? param.defaultValue : param.value;
            stringToReturn += "var $" + param.id + " = " + value + ";\n"
        });
        return stringToReturn;
    }

    let lines = [];
    const parameters = geometryEditor.getParameters();

    // Parameters from GeomObject or ParametersEditor
    lines = lines.concat(parameters.map(convertParameterToScript));
    lines = lines.concat(geometryEditor.items.map(convertParameterToScript));

    // Geometries
    geometryEditor.items = _.uniq(geometryEditor.items, function (w) {
        return w.name
    });
    lines = lines.concat(geometryEditor.items.map(convertItemToScript));
    return lines.join("\n");
}


function calculate_display_info(geometryEditor, callback) {


    if (!_.isFunction(callback)) {
        throw new Error("Expecting a callback");
    }
    geometryEditor.displayCache = geometryEditor.displayCache || {};


    const displayCache = geometryEditor.displayCache || {};
    const script = convertToScriptEx(geometryEditor);
    if (doDebug) {
        console.log("script =  \n" + chalk.yellow(script));
    }


    const runner = new scriptRunner.ScriptRunner({
        csg: fast_occ,
        occ: fast_occ,

        data: [],

        display: function (shape, metaData) {

            if (typeof(metaData) !== "string") {
                throw new Error("Internal Error, expecting a meta data of type string");
            }
            if (!shape instanceof occ.Solid) {
                throw new Error("Internal Error, expecting a shape");
            }
            shape._id = metaData;
            runner.env.data.push({shape: shape, id: metaData, hash: shape.hash});
        },
        reportError: function (err, metaData) {
            //xx console.log("report err =",err);
            runner.env.data.push({shape: null, id: metaData, hash: null, err: err});
        },
        shapeFactory: shapeFactory
    });
    const solidBuilderScript = "" + script + "";

    runner.run(solidBuilderScript,
        function done_callback() {
            const response = buildResponse(displayCache, runner.env.data, runner.env.logs);

            geometryEditor.displayCache = response.displayCache;
            callback(null, response);
        },
        function error_callback(err) {
            callback(err);
        }
    );

}

module.exports.calculate_display_info = calculate_display_info;
