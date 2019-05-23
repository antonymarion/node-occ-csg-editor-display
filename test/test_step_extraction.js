const should = require("should");
const fs  = require("fs");
const path = require("path");
const extractSteps = require("./../server/calculate_display_info").extractSteps;

// nota : http://stackoverflow.com/questions/805107/how-to-create-multiline-strings
function buildMultiLineString(f) {
    return f.toString()
      .replace(/\r/gm, "")
      // replace all space before | at the beginning of a line
      .replace(/\n *\|/g, "\n")
      .replace(/^[^/]+\/\*!\s\s?/, "")
      .replace(/\*\/(\n|.)*$/, "")
      .replace(/( ){2}/g, " ")
      .replace(/ *$/, "");

}


describe("recover step transformations from cartoonline script", function () {


    function extractSteps(script) {

        const regSTEPGUID = new RegExp("\\s*.*csg\\.makeStep\\(\"(.*)\"\\).*", "gm");
        let array1 = null;
        let arrayOfSteps = [];

        while ((array1 = regSTEPGUID.exec(script)) !== null) {

            const guidSTEP = array1[1];
            const stepDefinitionLine = array1[0];

            const regRotation = new RegExp("\\s*csg\\.makeStep\\(\".*\"\\).*\\.rotate\\(\\[(.*),(.*),(.*)\\],\\[(.*),(.*),(.*)\\],(.*)\\).*", "gm");
            const regTranslation = new RegExp("\\s*csg\\.makeStep\\(\".*\"\\).*\\.translate\\(\\[(.*),(.*),(.*)\\]\\).*", "gm");
            const regShapeName = new RegExp("\\s*(.*) = csg\\.makeStep\\(.*");
            const shapeName = regShapeName.exec(array1[0])[1];
            const regID = new RegExp("\\s*display\\(" + shapeName + ",\"(.*)\"\\)");
            const _id = regID.exec(script)[1];
            // display(shape2,"dde94078-7b2a-4e74-aa9a-c640a4e360e2");

            const matchesRotation = regRotation.exec(stepDefinitionLine);
            const matchesTranslation = regTranslation.exec(stepDefinitionLine);

            const isARotation = matchesRotation !== null;
            const isATranslation = matchesTranslation !== null;


            arrayOfSteps.push({
                shapeName: shapeName,
                _id: _id,
                guidSTEP: guidSTEP
            });

            if (isATranslation) {

                let translationVector = [parseFloat(matchesTranslation[1]), parseFloat(matchesTranslation[2]), parseFloat(matchesTranslation[3])];
                arrayOfSteps.filter(u=>u._id===_id)[0].translation = {vector: translationVector};
            }

            if (isARotation) {


                let rotationCenter = [parseFloat(matchesRotation[1]), parseFloat(matchesRotation[2]), parseFloat(matchesRotation[3])];
                let rotationAxis = [parseFloat(matchesRotation[4]), parseFloat(matchesRotation[5]), parseFloat(matchesRotation[6])];
                let rotationValue = parseFloat(matchesRotation[7]);

                arrayOfSteps.filter(u=>u._id===_id)[0].rotation = {center: rotationCenter, axis: rotationAxis, value: rotationValue};
            }

        }

        return arrayOfSteps;

    }

    function applyTransfos() {

    }


    it("should extract the the step files from a script", function () {


        const carto_script = helpers.buildMultiLineString(
            function () {/*!
|var $volume_of_shape2 = 0.0000010000000000002913;
|var $volume_of_shape3 = 999.9999999999998;
|var shape2;
|try {
|    shape2 = csg.makeStep("047131755f5dc1c495035d73400f2167").rotate([0,0,0],[1,0,0],50);
|    display(shape2,"dde94078-7b2a-4e74-aa9a-c640a4e360e2");
|} catch(err) {
|    console.log("building shape2 with id dde94078-7b2a-4e74-aa9a-c640a4e360e2 has failed");
|    console.log(" err = " + err.message);
|    reportError(err,"dde94078-7b2a-4e74-aa9a-c640a4e360e2");
|}
|
|var shape3;
|try {
|    shape3 = csg.makeBox([0,0,0],[10,10,10]).rotate([1,0,0],[1,0,0],50).translate([0,0,100000]);
|    display(shape3,"c95db942-05e7-4301-494d-a14ed9d46d6d");
|} catch(err) {
|    console.log("building shape3 with id c95db942-05e7-4301-494d-a14ed9d46d6d has failed");
|    console.log(" err = " + err.message);
|    reportError(err,"c95db942-05e7-4301-494d-a14ed9d46d6d");
|
*/
            });

        const expected = extractSteps(carto_script);
        expected.length.should.be.eql(1);
        expected[0].should.be.eql({
            shapeName: "shape2",
            _id: "dde94078-7b2a-4e74-aa9a-c640a4e360e2",
            guidSTEP: "047131755f5dc1c495035d73400f2167",
            rotation: {axis: [1, 0, 0], center: [0, 0, 0], value: 50},
        });

    });

});


// 'rotate#d85de5ff80a6107ef04d8ee9ca30e9c8062fe0bc([0,0,0],[1,0,0],50)'