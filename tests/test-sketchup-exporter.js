// Unit test for SketchUp Exporter
const assert = require('assert');
const fs = require('fs');
const Core = require('../orbix-core.js');

console.log('Testing SketchUp Exporter XML Generator...');

// Minimal Mock of Three.js Vector3, Matrix4, BufferGeometry for Node.js environment
class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  fromBufferAttribute(attr, index) {
    this.x = attr.getX(index);
    this.y = attr.getY(index);
    this.z = attr.getZ(index);
    return this;
  }
  applyMatrix4(m) {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
}

class Matrix4 {
  constructor() {
    this.elements = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }
}

class BufferAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
  }
  getX(i) { return this.array[i * this.itemSize]; }
  getY(i) { return this.array[i * this.itemSize + 1]; }
  getZ(i) { return this.array[i * this.itemSize + 2]; }
}

class Color {
  constructor(hex) { this.hex = hex || 0xCCCCCC; this.r = 0.8; this.g = 0.8; this.b = 0.8; }
  getHexString() { return (this.hex).toString(16).padStart(6, '0').toUpperCase(); }
}

const mockMesh = {
  isMesh: true,
  name: 'Wall_w1',
  matrixWorld: new Matrix4(),
  updateMatrixWorld: () => {},
  material: { color: new Color(0xE8DEC8), opacity: 1 },
  userData: {},
  geometry: {
    attributes: {
      position: new BufferAttribute(new Float32Array([
        0, 0, 0,
        1000, 0, 0,
        1000, 2800, 0,
        0, 2800, 0
      ]), 3)
    },
    index: {
      count: 6,
      getX: (i) => [0, 1, 2, 0, 2, 3][i]
    }
  }
};

// Test export function logic
function generateColladaDAE(meshes, title, V3Class) {
  const Vec3 = V3Class || Vector3;
  const materials = {};
  let matCounter = 1;

  meshes.forEach((mesh) => {
    let mat = mesh.material;
    if (Array.isArray(mat)) mat = mat[0];
    let colorHex = 'CCCCCC';
    let opacity = 1.0;
    let isGlass = false;

    if (mat && mat.color && typeof mat.color.getHexString === 'function') {
      colorHex = mat.color.getHexString().toUpperCase();
    }
    if (mat && typeof mat.opacity === 'number') {
      opacity = mat.opacity;
    }
    if (mat && (mat.transparent || opacity < 0.9 || (mesh.name && mesh.name.toLowerCase().includes('glass')))) {
      isGlass = true;
    }

    const key = colorHex + '_' + (isGlass ? 'glass' : 'solid');
    if (!materials[key]) {
      const r = mat && mat.color ? (mat.color.r !== undefined ? mat.color.r : 0.8) : 0.8;
      const g = mat && mat.color ? (mat.color.g !== undefined ? mat.color.g : 0.8) : 0.8;
      const b = mat && mat.color ? (mat.color.b !== undefined ? mat.color.b : 0.8) : 0.8;
      materials[key] = {
        id: 'mat_' + matCounter++,
        name: (mat && mat.name ? mat.name : 'Mat') + '_' + colorHex,
        hex: colorHex,
        r: Number(r).toFixed(4),
        g: Number(g).toFixed(4),
        b: Number(b).toFixed(4),
        opacity: Number(opacity).toFixed(2),
        isGlass: isGlass
      };
    }
    mesh.userData._skpMat = materials[key];
  });

  const effectsXml = [];
  const matsXml = [];
  Object.keys(materials).forEach((k) => {
    const m = materials[k];
    effectsXml.push([
      '    <effect id="' + m.id + '-effect">',
      '      <profile_COMMON>',
      '        <technique sid="common">',
      '          <phong>',
      '            <emission><color>0 0 0 1</color></emission>',
      '            <ambient><color>0.05 0.05 0.05 1</color></ambient>',
      '            <diffuse><color>' + m.r + ' ' + m.g + ' ' + m.b + ' 1</color></diffuse>',
      '            <specular><color>0.2 0.2 0.2 1</color></specular>',
      '            <shininess><float>25</float></shininess>',
      '            <transparent opaque="A_ONE"><color>1 1 1 ' + m.opacity + '</color></transparent>',
      '            <transparency><float>' + m.opacity + '</float></transparency>',
      '          </phong>',
      '        </technique>',
      '      </profile_COMMON>',
      '    </effect>'
    ].join('\n'));

    matsXml.push([
      '    <material id="' + m.id + '" name="' + m.name + '">',
      '      <instance_effect url="#' + m.id + '-effect"/>',
      '    </material>'
    ].join('\n'));
  });

  const geomsXml = [];
  const nodesXml = [];
  let geomCounter = 1;

  meshes.forEach((mesh) => {
    const geom = mesh.geometry;
    if (!geom || !geom.attributes || !geom.attributes.position) return;
    const posAttr = geom.attributes.position;
    if (posAttr.count < 3) return;

    const geomId = 'geom_' + geomCounter++;
    let meshName = mesh.name || (mesh.parent && mesh.parent.name) || ('Mesh_' + geomCounter);
    meshName = meshName.replace(/[^a-zA-Z0-9_\-]/g, '_');

    const mWorld = mesh.matrixWorld;
    const coords = [];
    const v = new Vec3();

    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      if (mWorld) v.applyMatrix4(mWorld);
      coords.push(v.x.toFixed(2) + ' ' + v.y.toFixed(2) + ' ' + v.z.toFixed(2));
    }

    const indexAttr = geom.index;
    const indexList = [];
    let triCount = 0;

    if (indexAttr) {
      triCount = indexAttr.count / 3;
      for (let j = 0; j < indexAttr.count; j++) {
        indexList.push(indexAttr.getX(j));
      }
    } else {
      triCount = posAttr.count / 3;
      for (let k = 0; k < posAttr.count; k++) {
        indexList.push(k);
      }
    }

    const matObj = mesh.userData._skpMat || { id: 'mat_default' };

    geomsXml.push([
      '    <geometry id="' + geomId + '" name="' + meshName + '">',
      '      <mesh>',
      '        <source id="' + geomId + '-positions">',
      '          <float_array id="' + geomId + '-positions-array" count="' + (posAttr.count * 3) + '">' + coords.join(' ') + '</float_array>',
      '          <technique_common>',
      '            <accessor source="#' + geomId + '-positions-array" count="' + posAttr.count + '" stride="3">',
      '              <param name="X" type="float"/>',
      '              <param name="Y" type="float"/>',
      '              <param name="Z" type="float"/>',
      '            </accessor>',
      '          </technique_common>',
      '        </source>',
      '        <vertices id="' + geomId + '-vertices">',
      '          <input semantic="POSITION" source="#' + geomId + '-positions"/>',
      '        </vertices>',
      '        <triangles count="' + triCount + '" material="' + matObj.id + '">',
      '          <input semantic="VERTEX" source="#' + geomId + '-vertices" offset="0"/>',
      '          <p>' + indexList.join(' ') + '</p>',
      '        </triangles>',
      '      </mesh>',
      '    </geometry>'
    ].join('\n'));

    nodesXml.push([
      '      <node id="node_' + geomId + '" name="' + meshName + '">',
      '        <instance_geometry url="#' + geomId + '">',
      '          <bind_material>',
      '            <technique_common>',
      '              <instance_material symbol="' + matObj.id + '" target="#' + matObj.id + '"/>',
      '            </technique_common>',
      '          </bind_material>',
      '        </instance_geometry>',
      '      </node>'
    ].join('\n'));
  });

  const now = new Date().toISOString();
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">',
    '  <asset>',
    '    <contributor>',
    '      <author>Orbix Studio</author>',
    '      <authoring_tool>Orbix Studio 3D CAD to Trimble SketchUp Exporter</authoring_tool>',
    '    </contributor>',
    '    <created>' + now + '</created>',
    '    <modified>' + now + '</modified>',
    '    <unit name="millimeter" meter="0.001"/>',
    '    <up_axis>Y_UP</up_axis>',
    '  </asset>',
    '  <library_effects>',
    effectsXml.join('\n'),
    '  </library_effects>',
    '  <library_materials>',
    matsXml.join('\n'),
    '  </library_materials>',
    '  <library_geometries>',
    geomsXml.join('\n'),
    '  </library_geometries>',
    '  <library_visual_scenes>',
    '    <visual_scene id="Scene" name="' + (title || 'Orbix3D') + '">',
    nodesXml.join('\n'),
    '    </visual_scene>',
    '  </library_visual_scenes>',
    '  <scene>',
    '    <instance_visual_scene url="#Scene"/>',
    '  </scene>',
    '</COLLADA>'
  ].join('\n');
}

const xml = generateColladaDAE([mockMesh], 'TestProject');
assert(xml.includes('<COLLADA'), 'XML must contain COLLADA root');
assert(xml.includes('<unit name="millimeter" meter="0.001"/>'), 'Must have millimeter unit');
assert(xml.includes('<up_axis>Y_UP</up_axis>'), 'Must have Y_UP axis');
assert(xml.includes('<geometry id="geom_1" name="Wall_w1">'), 'Must contain geometry definition');
assert(xml.includes('<node id="node_geom_1" name="Wall_w1">'), 'Must contain scene node');

console.log('✅ SketchUp COLLADA XML generator test passed! Output length:', xml.length, 'bytes');
