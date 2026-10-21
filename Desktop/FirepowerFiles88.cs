using System.Text.Json.Nodes;
namespace VRMGalgame;
internal sealed partial class EditorWindow{
 private object? FirepowerFile(string action,JsonNode? payload,Form owner){payload??=new JsonObject();payload["vehicleType"]="firepower";return VehicleFile(action=="exportFirepowerFile"?"exportVehicleFile":"importVehicleFile",payload,owner);}
}
