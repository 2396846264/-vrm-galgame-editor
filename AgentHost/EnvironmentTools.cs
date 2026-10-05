using System.Text.Json.Nodes;
namespace VRMGalgame.Agent;
internal static partial class Program {
    private static JsonObject Enum(params string[] values)=>new(){["type"]="string",["enum"]=new JsonArray(values.Select(v=>(JsonNode?)JsonValue.Create(v)).ToArray())};
    private static JsonObject Number()=>new(){["type"]="number"};
    private static JsonObject Bool()=>new(){["type"]="boolean"};
    private static JsonObject Vector()=>new(){["type"]="array",["items"]=Number(),["minItems"]=3,["maxItems"]=3};
    private static JsonObject Ids()=>new(){["type"]="array",["items"]=S("Existing node ID or a ref created earlier in this batch"),["minItems"]=1,["maxItems"]=2000};
    private static JsonObject Obj(JsonObject properties,params string[] required)=>new(){["type"]="object",["properties"]=properties,["required"]=new JsonArray(required.Select(v=>(JsonNode?)JsonValue.Create(v)).ToArray()),["additionalProperties"]=false};
    private static JsonObject NodeFields()=>new(){["name"]=S("Display name"),["assetId"]=S("Real sceneModel or image ID from get_project"),["position"]=Vector(),["rotationDegrees"]=Vector(),["scale"]=Vector(),["visible"]=Bool(),["width"]=Number(),["height"]=Number(),["color"]=S("#RRGGBB"),["intensity"]=Number(),["distance"]=Number(),["castShadow"]=Bool(),["unlit"]=Bool(),["alphaCutoff"]=Number()};
    private static JsonObject OperationSchema(){
        var add=NodeFields();add["op"]=Enum("add");add["kind"]=Enum("model","imagePlane","group","ground","light","sky");add["ref"]=S("Optional unique short name, usable by later operations in this batch");add["parentId"]=S("Group ID/ref or empty for scene root");
        return new JsonObject{["oneOf"]=new JsonArray(
            Obj(add,"op","kind"),
            Obj(new(){["op"]=Enum("update"),["nodeId"]=S("Node ID/ref"),["patch"]=Obj(NodeFields())},"op","nodeId","patch"),
            Obj(new(){["op"]=Enum("remove","ungroup"),["nodeIds"]=Ids()},"op","nodeIds"),
            Obj(new(){["op"]=Enum("duplicate","group"),["nodeIds"]=Ids(),["name"]=S("Group name (group only)"),["ref"]=S("One resulting root only")},"op","nodeIds"),
            Obj(new(){["op"]=Enum("reparent"),["nodeId"]=S("Node ID/ref"),["parentId"]=S("Group ID/ref, empty detaches while preserving world transform")},"op","nodeId","parentId"),
            Obj(new(){["op"]=Enum("snap"),["nodeIds"]=Ids(),["gridSize"]=Number()},"op","nodeIds","gridSize"),
            Obj(new(){["op"]=Enum("settings"),["name"]=S("Environment name"),["background"]=S("#RRGGBB"),["camera"]=Obj(new(){["position"]=Vector(),["target"]=Vector(),["fov"]=Number()}),["lighting"]=Obj(new(){["color"]=S("#RRGGBB"),["intensity"]=Number(),["ambientIntensity"]=Number()})},"op")
        )};
    }
    private static JsonArray EnvironmentTools()=>new(
        Tool("get_environments","List all environments, act/title references, coordinates and environment-window unsaved/busy status.",new(),readOnly:true),
        Tool("get_environment","Read full scene nodes, transforms, world positions, light and game camera. Includes actual pending edits in the open environment window. Do not edit until sync_environment_editor clears pending changes.",new(){["environmentId"]=S("Environment ID")},["environmentId"],true),
        Tool("inspect_scene_asset","Measure a real GLB model's authored bounds, size, triangle count and animation clips, or image pixel size. Inspect before placement; never guess model units or ground height.",new(){["assetId"]=S("sceneModel or image ID")},["assetId"],true),
        Tool("create_environment","Create a reusable environment with default ground, light and camera. Does not change any act until set_environment_reference. One undo step; save to persist.",new(){["name"]=S("Environment name"),["expectedRevision"]=Revision},["name","expectedRevision"]),
        Tool("edit_environment","Atomically arrange an existing environment in up to 200 operations. add/update position and scale are LOCAL, rotations use rotationDegrees XYZ. IDs may refer to earlier ref names. group/reparent preserve world position; remove deletes descendants; duplicate offsets X by 0.35m. settings updates camera/light/sky color. All validation errors cancel the whole batch. At most one sky and two extra shadow lights. One undo step; save to persist.",new(){["environmentId"]=S("Environment ID"),["expectedEnvironmentRevision"]=new JsonObject{["type"]="integer"},["expectedRevision"]=Revision,["operations"]=new JsonObject{["type"]="array",["items"]=OperationSchema(),["minItems"]=1,["maxItems"]=200}},["environmentId","expectedEnvironmentRevision","expectedRevision","operations"]),
        Tool("set_environment_reference","Use an environment for an existing dialogue act or title screen. Empty environmentId restores default sky. Existing dialogue and character setup are preserved.",new(){["target"]=Enum("act","title"),["actId"]=S("Required for target act"),["environmentId"]=S("Environment ID or empty"),["expectedRevision"]=Revision},["target","environmentId","expectedRevision"]),
        Tool("open_environment","Open a specific environment in the independent environment editor for inspection. Does not assign it to a story act.",new(){["environmentId"]=S("Environment ID")},["environmentId"]),
        Tool("capture_environment","Open the requested environment and return a PNG image of the actual environment editor. game uses the saved game camera; editor keeps the inspection view. Use to verify framing after placement; includes image content for MCP clients.",new(){["environmentId"]=S("Environment ID"),["view"]=Enum("game","editor")},["environmentId"]),
        Tool("sync_environment_editor","Save any pending edits/imports in the separate environment window using the existing project archive writer. Reread get_project/get_environment afterward; revisions may change. Does not discard author edits.",new())
    );
}
