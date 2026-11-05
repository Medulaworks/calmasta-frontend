import {sha256} from '@noble/hashes/sha2.js';

// Hash slices so large uploads do not need a second whole-file memory allocation.
export async function blobSha256(blob:Blob):Promise<string>{
 const hash=sha256.create();
 try{
  const chunkBytes=1024*1024;
  for(let offset=0;offset<blob.size;offset+=chunkBytes){hash.update(new Uint8Array(await blob.slice(offset,offset+chunkBytes).arrayBuffer()));}
  return Array.from(hash.digest(),byte=>byte.toString(16).padStart(2,'0')).join('');
 }finally{hash.destroy();}
}
