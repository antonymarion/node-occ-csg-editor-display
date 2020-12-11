const util = require("util");
const calculate_display_info = require("../server/calculate_display_info").calculate_display_info;
const should = require("should");
const async = require("async");
const nodeocc = require("node-occ");
const fast_occ = nodeocc.fastBuilder.occ;
const shapeFactory = nodeocc.shapeFactory;
const scriptRunner = nodeocc.scriptRunner
const geometry_editor = require("node-occ-csg-editor");
const buildResponse = require("./../server/calculate_display_info").buildResponse;
const occ = nodeocc.occ;

describe("CalculateDisplayInfo", function () {


    it("should calculate display information for a simple geometry shape", function (done) {

        const g = new geometry_editor.GeometryEditor();
        const b = g.addBox();
        b.point1.set(0, 0, 0);
        b.point2.set(100, 200, 200);
        b.isVisible = true;


        calculate_display_info(g, function (err, result) {

            if (err) {
                return done(err);
            }
            //xx console.log("displayCache", result.displayCache);
            //xx console.log("result", result);

            result.displayCache[b._id].hash.should.eql("13c9a8f52b4e00996dc18ffd0775f2e7d923381e");
            result.meshes[b._id].mesh.should.be.instanceOf(Object);
            should.not.exist(result.displayCache[b._id].err);
            done();
        });
    });

    it("should calculate display information when building a element raises an exception", function (done) {
        const g = new geometry_editor.GeometryEditor();
        const b = g.addBox();
        b.point1.set(0, 0, 0);
        b.point2.set(0, 0, 0); // intentionally, an empty box
        b.isVisible = true;


        calculate_display_info(g, function (err, result) {

            if (err) {
                //xx console.log("err =",err);
                return done(err);
            }
            //xx console.log("displayCache", result.displayCache);
            //xx console.log("result", result);

            should.not.exist(result.displayCache[b._id].hash);
            result.displayCache[b._id].err.should.eql("cannot build box");

            done();
        });
    });

    xit("should calculate display information and skipped already known entities", function (done) {


        const g = new geometry_editor.GeometryEditor();
        const b = g.addBox();
        b.point1.set(0, 0, 0);
        b.point2.set(100, 100, 20);
        b.isVisible = true;

        const c = g.addCylinder();
        c.isVisible = true;
        c.point1.set(50, 50, -10);
        c.point2.set(50, 50, 30);
        c.radius.set(20);

        const s = g.addCutOperation(b, c);
        s.isVisible = true;

        async.series([

            function (callback) {

                calculate_display_info(g, function (err, result) {
                    if (err) {
                        return callback(err);
                    }


                    // g.displayCache[b._id].hash.should.eql("439f2be0b62be87306dbba4b702d06015364a1da");
                    // g.displayCache[c._id].hash.should.eql("5d754c32fa04cbdf95d704103198da616ea194cb");
                    // g.displayCache[s._id].hash.should.eql("2cd2d488c755c16c44398c0dac95f27baeb22cdb");

                    result.meshes[b._id].mesh.should.be.instanceOf(Object);
                    result.meshes[c._id].mesh.should.be.instanceOf(Object);
                    result.meshes[s._id].mesh.should.be.instanceOf(Object);

                    //xx console.log(util.inspect(g.displayCache, {colors: true}));
                    callback(err);
                });

            },
            function (callback) {

                c.point1.set(50 + 1, 50, -10);
                c.point2.set(50 + 1, 50, 30);

                callback();
            },

            function (callback) {

                calculate_display_info(g, function (err, result) {
                    if (err) {
                        return callback(err);
                    }


                    g.displayCache[b._id].hash.should.eql("439f2be0b62be87306dbba4b702d06015364a1da");

                    g.displayCache[c._id].hash.should.eql("7c233142412ea7bc6ebc72e850d6578515a47d4b");
                    g.displayCache[s._id].hash.should.eql("3c3941b4987dea21cd53703cfacef1c130dd2096");

                    result.meshes[b._id].mesh.should.eql("reuse");
                    result.meshes[c._id].mesh.should.be.instanceOf(Object);
                    result.meshes[s._id].mesh.should.be.instanceOf(Object);

                    //xx console.log(util.inspect(g.displayCache, {colors: true}));
                    callback(err);
                });

            },

        ], done);

    });

    xit("should calculate display information for a parametrized shape", function (done) {

        const g = new geometry_editor.GeometryEditor();

        g.setParameters([{id: "length", value: 10}, {id: "thickness", value: 1}]);

        const b1 = g.addBox();
        b1.point1.set(0, 0, 0);
        b1.point2.set("$length", "$length", "$length");
        b1.isVisible = false;

        const b2 = g.addBox();
        b2.point1.set("$thickness", "$thickness", "$thickness");
        b2.point2.set("$length-$thickness", "$length-$thickness", "$length+10");
        b2.isVisible = false;

        const s = g.addCutOperation(b1, b2);
        s.isVisible = true;

        async.series([
            function (callback) {
                calculate_display_info(g, function (err, result) {

                    if (err) {
                        return done(err);
                    }
                    //xx console.log(util.inspect(result,{colors:true}));
                    //xx console.log("displayCache", result.displayCache);
                    //xx console.log("result", result);

                    // result.displayCache[s._id].hash.should.eql("cbe05dc0295b76cb590abc7fbec33301dd266739");
                    result.meshes[s._id].mesh.should.be.instanceOf(Object);
                    callback();
                });

            },
            function (callback) {
                // now change some parameters
                g.setParameter("length", 20);
                g.setParameter("thickness", 4);
                callback();
            },
            function (callback) {
                calculate_display_info(g, function (err, result) {

                    if (err) {
                        return done(err);
                    }

                    result.displayCache[s._id].hash.should.eql("40b1a9663f4f7b8b8a10e14642200be4cd0fd4a8");
                    result.meshes[s._id].mesh.should.be.instanceOf(Object);
                    callback();
                });
            },
        ], done);


    });

    it("BUGLinux - should return a mesh with 2 faces (lateral+bottom) in the cone (small radius equals 0)", function (done) {

        const mySimpleConeScriptToEvaluate = "var $volume_of_shape0 = 14.660765716752369;\n" +
            "var shape0;\n" +
            "try {\n" +
            "    shape0 = csg.makeCone([0,0,0],2,[0,0,2],0);\n" +
            "    display(shape0,\"3eb614d8-2835-40bc-7ed7-584648c53ffe\");\n" +
            "} catch(err) {\n" +
            "   console.log(\"building shape0 with id 3eb614d8-2835-40bc-7ed7-584648c53ffe has failed\");\n" +
            "   console.log(\" err = \" + err.message);\n" +
            "   reportError(err,\"3eb614d8-2835-40bc-7ed7-584648c53ffe\");\n" +
            "}\n" +
            "\n";

        const displayCache = {};
        const runner = new scriptRunner.ScriptRunner({
            csg: fast_occ,
            occ: fast_occ,

            data: [],

            displayFillet: function (shape, metaData, factor) {
                if (typeof (metaData) !== "string") {
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

                if (typeof (metaData) !== "string") {
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

        runner.run(mySimpleConeScriptToEvaluate,
            function done_callback() {

                const response = buildResponse(displayCache, runner.env.data, runner.env.logs);
                const myMeshes = Object.keys(response.meshes);
                myMeshes.length.should.be.eql(1);
                const theMesh = response.meshes[myMeshes[0]];
                theMesh.mesh.faces.length.should.be.eql(2);

                console.log("response ", response);
                console.log("theMesh ", theMesh);
                console.log("theMesh.mesh ", theMesh.mesh);

                done();

            }, function error_callback(err) {
                done(err);
            });
    });
});
