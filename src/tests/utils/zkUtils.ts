

export function g1Uncompressed(curve: any, p1Raw: any): Buffer {
    let p1 = curve.G1.fromObject(p1Raw);

    let buff = new Uint8Array(64); // 64 bytes for G1 uncompressed
    curve.G1.toRprUncompressed(buff, 0, p1);

    return Buffer.from(buff);
}

export function g2Uncompressed(curve: any, p2Raw: any): Buffer {
    let p2 = curve.G2.fromObject(p2Raw);

    let buff = new Uint8Array(128); // 128 bytes for G2 uncompressed
    curve.G2.toRprUncompressed(buff, 0, p2);

    return Buffer.from(buff);
}
