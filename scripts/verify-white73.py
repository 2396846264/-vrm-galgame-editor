import json,sys,pathlib,math
import ufbx
folder=pathlib.Path(sys.argv[1]);rows=[]
assert list(folder.glob("*.mixamo.fbx")), "No exports to verify"
for f in folder.glob('*.mixamo.fbx'):
 raw=f.read_bytes();assert int.from_bytes(raw[23:27],"little")==7300,(f.name,"not FBX 2013")
 scene=ufbx.load_file(str(f));assert scene.metadata.version==7300
 assert not scene.metadata.warnings,(f.name,'warnings')
 assert len(scene.meshes)==1,(f.name,'mesh count')
 mesh=scene.meshes[0];assert len(mesh.skin_deformers)==1
 skin=mesh.skin_deformers[0];assert len(skin.vertices)==mesh.num_vertices
 errors=[]
 for i,v in enumerate(skin.vertices):
  pairs=[skin.weights[j] for j in range(v.weight_begin,v.weight_begin+v.num_weights)]
  assert pairs and all(math.isfinite(w.weight) and w.weight>0 for w in pairs),(f.name,i)
  errors.append(abs(sum(w.weight for w in pairs)-1))
 assert max(errors)<1e-6
 assert all(c.bone_node and c.bone_node.name.startswith('mixamorig:') for c in skin.clusters)
 assert abs(scene.settings.unit_meters-.01)<1e-8
 assert len(mesh.vertex_normal.values)>0
 rows.append(dict(file=f.name,vertices=mesh.num_vertices,triangles=mesh.num_triangles,clusters=len(skin.clusters),maxWeightError=max(errors),normals=len(mesh.vertex_normal.values),warnings=0,fbxVersion=scene.metadata.version))
report=dict(ok=True,independentParser='ufbx 0.0.5',results=rows)
print(json.dumps(report,ensure_ascii=True));pathlib.Path(sys.argv[2]).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
