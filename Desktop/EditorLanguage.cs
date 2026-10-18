using System.Text.Json;
using System.Text.Json.Nodes;
namespace VRMGalgame;
internal static class EditorLanguage
{
    private static readonly Lazy<JsonObject> Catalog=new(()=>{
        using var stream=typeof(EditorLanguage).Assembly.GetManifestResourceStream("VRMGalgame.editor-languages.json");
        return stream==null?new JsonObject():JsonNode.Parse(stream)!.AsObject();
    });
    internal static string Language {get;private set;}="zh-CN";
    internal static string T(string source){
        if(Language=="zh-CN")return source;
        if(Catalog.Value[source]?[Language]?.GetValue<string>() is {} translated)return translated;
        return string.Join('\n',source.Split('\n').Select(line=>Catalog.Value[line]?[Language]?.GetValue<string>()??line));
    }
    internal static object Select(Form form,JsonNode? payload,string title){
        Language=payload?["language"]?.GetValue<string>() is "en"?"en":payload?["language"]?.GetValue<string>() is "ja"?"ja":"zh-CN";
        form.Text=T(title);return new{language=Language};
    }
    internal static void Localize(Control control){control.Text=T(control.Text);foreach(Control child in control.Controls)Localize(child);}
}
