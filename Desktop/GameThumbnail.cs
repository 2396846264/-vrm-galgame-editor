using System.Drawing.Imaging;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task<object> CaptureGameThumbnail(JsonNode? payload){
  if(web.CoreWebView2==null)throw new Exception("游戏画面尚未准备好。");
  double Number(string key,double fallback){double value=payload?[key]?.GetValue<double>()??fallback;return double.IsFinite(value)?value:fallback;}
  double viewportWidth=Number("viewportWidth",1),viewportHeight=Number("viewportHeight",1);
  if(viewportWidth<=0||viewportHeight<=0)throw new Exception("游戏画面尺寸无效。");
  using var stream=new MemoryStream();
  await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);
  stream.Position=0;using var source=Image.FromStream(stream);
  double sx=source.Width/viewportWidth,sy=source.Height/viewportHeight;
  float x=(float)Math.Clamp(Number("x",0)*sx,0,source.Width-1),y=(float)Math.Clamp(Number("y",0)*sy,0,source.Height-1);
  float width=(float)Math.Clamp(Number("width",viewportWidth)*sx,1,source.Width-x),height=(float)Math.Clamp(Number("height",viewportHeight)*sy,1,source.Height-y);
  using var thumbnail=new Bitmap(320,180);
  using(var graphics=Graphics.FromImage(thumbnail)){
   graphics.InterpolationMode=System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
   graphics.DrawImage(source,new Rectangle(0,0,320,180),new RectangleF(x,y,width,height),GraphicsUnit.Pixel);
  }
  using var encoded=new MemoryStream();using var parameters=new EncoderParameters(1);
  parameters.Param[0]=new EncoderParameter(System.Drawing.Imaging.Encoder.Quality,70L);
  thumbnail.Save(encoded,ImageCodecInfo.GetImageEncoders().First(codec=>codec.MimeType=="image/jpeg"),parameters);
  return new {dataUrl="data:image/jpeg;base64,"+Convert.ToBase64String(encoded.ToArray()),width=320,height=180};
 }
}
