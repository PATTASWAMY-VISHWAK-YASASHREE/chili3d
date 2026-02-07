import { Vector3 } from "three";
import { ThreeHelper } from "../src/threeHelper";

describe("ThreeHelper Benchmark", () => {
    test("fromXYZ performance", () => {
        const iterations = 10000000;
        const input = { x: 1, y: 2, z: 3 };

        let start = performance.now();
        for (let i = 0; i < iterations; i++) {
            ThreeHelper.fromXYZ(input);
        }
        let end = performance.now();
        console.log(`fromXYZ (allocation): ${end - start}ms`);

        const target = new Vector3();
        start = performance.now();
        for (let i = 0; i < iterations; i++) {
            ThreeHelper.fromXYZ(input, target);
        }
        end = performance.now();
        console.log(`fromXYZ (reuse): ${end - start}ms`);
    });
});
