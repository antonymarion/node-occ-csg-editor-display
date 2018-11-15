const nodeocc = require("node-occ");
const fs = require("fs");
const assert = require("assert");
const async = require("async");
const _ = require("underscore");
const geometry_editor = require("node-occ-csg-editor");
const GeomTransfoBatch = geometry_editor.GeomTransfoBatch;
const occ = nodeocc.occ;
const shapeFactory = nodeocc.shapeFactory;
const scriptRunner = nodeocc.scriptRunner;
const fast_occ = nodeocc.fastBuilder.occ;
const chalk = require("chalk");
const doDebug = false;
const path = require("path");


function construct_databasesFilename(filename) {

    // 1st choice , use the databases folder above this file
    let databasesFolder = path.join(process.cwd(), "databases/repository");
    if (!fs.existsSync(databasesFolder)) {
        databasesFolder = path.join(__dirname, "../databases/repository");
        if (!fs.existsSync(databasesFolder)) {
            databasesFolder = path.join(__dirname, "../../databases/repository");
            if (!fs.existsSync(databasesFolder)) {
                // take databases env variable
                databasesFolder = process.env["DATABASES"];

                if (!fs.existsSync(databasesFolder)) {
                    throw new Error(" Cannot find databases folder. please set the databases variable to a temporary folder");
                }
            }
        }
    }

    let str;

    str = path.join(databasesFolder, filename);
    str = str.replace(/\\/gm, "/");

    return str;
}

function buildStepResponse(cacheBefore, meshes, data, logs, callback) {

    assert(data instanceof Array);

    const displayCache = {};

    let response = {solids: [], logs: []};
    let counter = 1;

    const customColor = [Math.random(), Math.random(), Math.random()];

    async.forEach(data,
        function (dataItem, callback) {

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

                    async.series([
                        function (callback) {
                            if (!shape.cmd || shape.cmd.indexOf("makeStep") === -1) {
                                return callback();
                            }
                            else {

                                const guid = shape.cmd.match(/makeStep\(\"(.*)\"\)/)[1];

                                let pathToStep = construct_databasesFilename( guid + ".stp" );
                                const upperCase = fs.existsSync(construct_databasesFilename( guid + ".STEP"));

                                if (upperCase) {
                                    path =  construct_databasesFilename(  guid + ".STEP" );
                                }

                                console.log("my_path", pathToStep);
                                occ.readSTEP(path, function (err, _solids) {

                                    solids = _solids;
                                    const solid = occ.compound(solids);

                                    if (err) {
                                        return callback(new Error(" readStep returned error = " + err.message + " while reading " + filename + " _solids =", _solids.length));
                                    } else {
                                        console.log(" read ", solids.length, " solids");
                                        // let i = 0;
                                        // _solids.forEach(solid => {
                                        solid.name = solid.name || guid; // + i;
                                        // i++;
                                        {
                                            solid.customColor = customColor;
                                            let mesh = occ.buildSolidMesh(solid);
                                            displayCache[dataItem.id] = {hash: mesh.uuid, err: null};
                                            meshes[dataItem.id] = {mesh: mesh};
                                            // meshes[dataItem.id + i] = {mesh: mesh};
                                        }
                                        // });

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
                                        return callback();
                                    }

                                });
                            }

                        }
                    ], function (err) {


                        return callback(err, response);

                    });

                }
                catch (err) {
                    //Xx console.log(" meshing shape  ", shape._id ," has failed with error ",err.message);
                    displayCache[dataItem.id] = {hash: shape.uuid, err: err.message};
                    meshes[dataItem.id] = {mesh: null};
                    return callback(err);
                }

            }

        }, function (err) {
            // response.meshes = response.meshes.concat(data)
            return callback(err, response);
        });
}


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
    const name = getName(item);
    let str = "var " + name + ";\n";
    str += "try {\n";
    str += "    " + name + " = " + item.toScript(context) + "\n";
    if (item.isVisible) {
        if (!item.filletMode) {
            str += "    display(" + name + ",\"" + item._id + "\");\n";
        }
        else {
            str += "    displayFillet(" + name + ",\"" + item._id + "\"," + item.filletFactor + ");\n";
        }
    }
    str += "} catch(err) {\n";
    str += `   console.log("building ${name} with id ${item._id} has failed");\n`;
    str += `   console.log(" err = " + err.message);\n`;
    str += "   reportError(err,\"" + item._id + "\");\n";
    str += "}\n";

    return str;
}

function createDisplayStringForConnectors(localItem, context) {
    let str = "";
    const nbOfConnectors = localItem.getWidgetConnectors().length;
    for (var l = 0; l < nbOfConnectors; l++) {
        str = createDisplayString(localItem.getWidgetConnectors()[l]._linked, context) + str;

        if (localItem.getWidgetConnectors()[l]._linked) {
            str = createDisplayStringForConnectors(localItem.getWidgetConnectors()[l]._linked, context) + str;
        }
    }

    return str;
}


function overrideParametersName(localItem, str) {
    if (!localItem) return "";
    if (!localItem.parameters) return "";
    const lgth = localItem.parameters.length;

    for (let i = 0; i < lgth; i++) {
        const param = localItem.parameters[i];
        var find = param.id.split("_" + localItem.name + "_" + localItem.geometriesLibGUID)[0];
        let re = new RegExp(find + "(?![A-Za-z0-9]|[a-zA-Z]*_)", "g");
        str = str.replace(re, param.id);
    }

    return str;
}

String.prototype.replaceBetween = function (start, end, what) {
    return this.substring(0, start) + what + this.substring(end);
};


function overrideParametersNameForGeometries(localItem, str) {
    // même code que node-occ-csg-editor-display => à refactoriser!
    if (localItem.parameters) {
        localItem.parameters = localItem.parameters.filter(k => !!k);
        let paramIdRootNames = [];

        localItem.parameters = localItem.parameters.sort(function (a, b) {
            // ASC  -> a.length - b.length
            // DESC -> b.length - a.length
            return b.id.length - a.id.length;
        });


        localItem.parameters.forEach(param => {
            if (param && param.id !== param.displayName) {
                let find = param.id.split("_" + localItem.origin.geometryName + "_" + localItem.origin.libName)[0];
                paramIdRootNames.push(find);
                let re = new RegExp(find + "(?![A-Za-z0-9]|[a-zA-Z]*_)", "g");
                str = str.replace(re, param.id);
            }
        });

    }

    return str;
}


function convertToScriptEx(geometryEditor) {

    const context = {};

    function convertItemToScript(item) {

        let str = "";

        // First define intermediate dependancies shapes for an eventuel following compound object
        if (item.geometries || (!item.geometries && item.origin.libName != "" && item.origin.geometryName != "")) {
            // if (item.geometries) {
            if (item.geometries) {
                for (var j = 0; j < item.geometries.length; j++) {
                    let localItem = item.geometries[j];
                    str = createDisplayStringForConnectors(localItem, context) + str;
                }
                str += createDisplayString(item, context);

                str = overrideParametersName(item.geometries[0], str);
            }
            else {
                str += createDisplayString(item, context);
                str = overrideParametersNameForGeometries(item, str);
            }
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
        if (!item.geometries && !!item.defaultValue && (!!item.displayName || !!item.id)) {
            const value = (item.value === null || item.value === undefined) ? item.defaultValue : item.value;
            return "var $" + item.id + " = " + value + ";"
        }
        let parameters = item.parameters;

        if (!parameters) {
            return;
        }

        let stringToReturn = "";
        parameters = parameters.filter(w => w);
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
    lines = lines.concat(geometryEditor.items.map(convertItemToScript));

    lines = lines.filter(x => x != undefined);

    // lines lines.forEach(u=>ifu.split("\n"));
    lines = _.uniq(lines);

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

        displayFillet: function (shape, metaData, factor) {
            if (typeof(metaData) !== "string") {
                throw new Error("Internal Error, expecting a meta data of type string");
            }
            if (!shape || !shape instanceof occ.Solid) {
                throw new Error("Internal Error, expecting a shape");
            }


            // --------------------------------------------
            // Select vertical edges with vertex P1 and P6
            // --------------------------------------------
            // function same(a, b, tol) {
            //     return Math.abs(a - b) < tol;
            // }
            // function selectEdge(edges, p) {
            //
            //     if (p instanceof occ.Vertex) {
            //         p = occ.makeVertex(p)
            //     }
            //     const results = edges.filter(function (edge) {
            //         const firstVertex = edge.firstVertex;
            //         const lastVertex = edge.lastVertex;
            //         return ( samePoint(firstVertex, p) || samePoint(lastVertex, p)) &&
            //             same(firstVertex.x, lastVertex.x, 0.01) &&
            //             same(firstVertex.y, lastVertex.y, 0.01);
            //     });
            //     return results[0];
            // }

            const edges = shape.getEdges();
            // const edges_for_filet = [selectEdge(edges, p2), selectEdge(edges, p5)];
            // shape = occ.makeFillet(shape,shape.getCommonEdges(shape.getFaces()[0], shape.getFaces()[5]),2)
            shape = occ.makeFillet(shape, edges, factor / 10)
            shape._id = metaData;
            runner.env.data.push({shape: shape, id: metaData, hash: shape.hash});
        },

        display: function (shape, metaData) {

            if (typeof(metaData) !== "string") {
                throw new Error("Internal Error, expecting a meta data of type string");
            }
            if (!shape || !shape instanceof occ.Solid) {
                throw new Error("Internal Error, expecting a shape");
            }

            // const edges = shape.getEdges();
            // const edges_for_filet = [selectEdge(edges, p2), selectEdge(edges, p5)];
            // shape = occ.makeFillet(shape,shape.getCommonEdges(shape.getFaces()[0], shape.getFaces()[5]),2)
            // shape = occ.makeFillet(shape,edges,2)
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


    const isThereStepInside = solidBuilderScript ? (solidBuilderScript.indexOf("makeStep") !== -1 && solidBuilderScript.indexOf("makeStep(\"\")") === -1) : false;

    runner.run(solidBuilderScript,
        function done_callback() {

            // first response is the response with data filtered (not containing step file paths)
            const response = buildResponse(displayCache, runner.env.data, runner.env.logs);

            if (!isThereStepInside) {
                return callback(null, response);
            }
            else {

                // second response is the response including only data created from step files path
                buildStepResponse(displayCache, response.meshes, runner.env.data, runner.env.logs, function (err, response2) {

                    if (err) {
                        return callback(err);
                    }
                    return callback(null, response2);

                });

            }


            // buildResponse(displayCache, runner.env.data, runner.env.logs, function (err, responseTOSend) {
            //
            //     geometryEditor.displayCache = responseTOSend.displayCache;
            //     callback(null, responseTOSend);
            //
            // });

        },
        function error_callback(err) {
            callback(err);
        }
    );

}

module.exports.calculate_display_info = calculate_display_info;
