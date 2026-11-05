import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {blobSha256} from './blob-sha256';
it('hashes incrementally without reading the full blob into memory',async()=>{
 const blob=new Blob([new Uint8Array(3*1024*1024+17).fill(7)]);
 const expected=createHash('sha256').update(new Uint8Array(await blob.arrayBuffer())).digest('hex');
 Object.defineProperty(blob,'arrayBuffer',{value:()=>{throw Error('whole-file read forbidden');}});
 expect(await blobSha256(blob)).toBe(expected);
});
