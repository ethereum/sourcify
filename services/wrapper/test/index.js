const chai = require("chai");
const sourcifyWrapper = require("../dist/index");

describe("Sourcify-wrapper", function() {
    it("should get Natspec of a fully verified contract", async function() {
        const natspec = await sourcifyWrapper.getNatspec("100", "0x097707143e01318734535676cfe2e5cF8b656ae8");
        chai.expect(natspec.devdoc).to.exist;
        chai.expect(natspec.userdoc).to.exist;
    });
});
