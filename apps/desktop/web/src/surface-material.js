// Geographic imagery is a single bounded photograph, not a repeating texture.
export function surfaceMaterialDefinition(image){
 if(!(image.width>0&&image.height>0))throw new Error('Invalid surface photograph.');
 // Cesium clones fabric defaults. Assign the actual canvas after construction
 // because DOM canvas constructors cannot be invoked by a generic deep clone.
 return {fabric:{type:'MarsSurfacePhoto',uniforms:{image:'czm_defaultImage',halfPixel:{x:.5/image.width,y:.5/image.height}},source:`
czm_material czm_getMaterial(czm_materialInput materialInput) {
 czm_material material = czm_getDefaultMaterial(materialInput);
 vec2 uv = clamp(materialInput.st, halfPixel, vec2(1.0) - halfPixel);
 vec4 photograph = texture(image, uv);
 if (photograph.a < 0.99) discard;
 material.diffuse = photograph.rgb;
 material.alpha = 1.0;
 return material;
}`},translucent:false};
}
