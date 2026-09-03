import { describe, expect, it } from "vitest";
import { serializeForJson } from "./serialize";

describe("serializeForJson", () => {
  it("serializes BigInt values as lossless decimal strings", () => {
    expect(
      serializeForJson({
        amount: BigInt("9007199254740993"),
        nested: [BigInt(42)],
      }),
    ).toEqual({
      amount: "9007199254740993",
      nested: ["42"],
    });
  });
});
