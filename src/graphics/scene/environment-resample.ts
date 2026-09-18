import { DataUtils } from 'three/webgpu';
import type { HDRImage } from './studio-light.ts';

/**
 * Box-filter an equirectangular RGBA16F map down by an integer factor, averaging
 * in linear light. Output is always four channels with alpha written as 1. The
 * build script uses this to emit the studio map at half resolution — the
 * embed's transfer budget — and the lighting audit uses the same function so
 * the shipped bytes stay verifiable against the authored HDR.
 */
export function downsampleEnvironment(image:HDRImage,factor:number):HDRImage {
  if(!Number.isInteger(factor)||factor<1)throw new Error(`Downsample factor must be a positive integer, got ${factor}`);
  if(factor===1)return image;
  const {width,height,data}=image,channels=data.length/(width*height);
  if(width%factor||height%factor)throw new Error(`${width}×${height} does not divide by ${factor}`);
  const outWidth=width/factor,outHeight=height/factor,output=new Uint16Array(outWidth*outHeight*4);
  const fromHalf=DataUtils.fromHalfFloat,toHalf=DataUtils.toHalfFloat,samples=factor*factor;
  for(let y=0;y<outHeight;y++)for(let x=0;x<outWidth;x++) {
    let r=0,g=0,b=0;
    for(let dy=0;dy<factor;dy++)for(let dx=0;dx<factor;dx++) {
      const k=((y*factor+dy)*width+(x*factor+dx))*channels;
      r+=fromHalf(data[k]);g+=fromHalf(data[k+1]);b+=fromHalf(data[k+2]);
    }
    const o=(y*outWidth+x)*4;
    output[o]=toHalf(r/samples);output[o+1]=toHalf(g/samples);output[o+2]=toHalf(b/samples);output[o+3]=toHalf(1);
  }
  return {data:output,width:outWidth,height:outHeight};
}
