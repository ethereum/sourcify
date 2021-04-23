const chai = require("chai");
const sourcifyWrapper = require("../dist/index");

describe("Sourcify-wrapper", function () {
    it("should get the Natspec of a fully verified contract", async function () {
        const natspec = await sourcifyWrapper.getNatspec("100", "0x097707143e01318734535676cfe2e5cF8b656ae8");
        chai.expect(natspec.devdoc).to.exist;
        chai.expect(natspec.userdoc).to.exist;
    });

    it("should not get the Natspec of a non-verified contract", async function () {
        const fakeAddress = "0x00000000000000000000000000000000000000000";
        try {
            await sourcifyWrapper.getNatspec("100", fakeAddress);
        } catch (err) {
            chai.expect(err.message).to.include(`Could not get metadata from chain 100 and address ${fakeAddress}. Try modifying the options.`);
            return;
        }

        throw new Error("The test should have thrown-caught earlier.");
    });

    it("should not get the Natspec of a partially verified contract when not told to do so", async function() {
        try {
            await sourcifyWrapper.getNatspec("100", "0x00fAbaedE38C66b3a54913FD049e40A2C1b5cEfF");
        } catch (err) {
            chai.expect(err);
            return;
        }

        throw new Error("The test should have thrown-caught earlier.");
    });

    it("should get the Natspec of a partially verified contract when told to do so", async function() {
        const natspec = await sourcifyWrapper.getNatspec("100", "0x00fAbaedE38C66b3a54913FD049e40A2C1b5cEfF", { allowPartial: true });
        chai.expect(natspec.devdoc).to.exist;
        chai.expect(natspec.devdoc).to.exist;
    });
});
