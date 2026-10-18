using System.Diagnostics;
namespace VRMGalgame;
internal sealed partial class EditorWindow
{
    private object OpenThirdPartyNotices()
    {
        string folder = Path.Combine(appDirectory, "licenses");
        string filename = Path.Combine(folder, "THIRD_PARTY_NOTICES.txt");
        if (!File.Exists(filename)) throw new IOException("第三方许可文件缺失，请重新解压完整程序。");
        var dialog = new Form { Text = "第三方声明与许可", StartPosition = FormStartPosition.CenterParent,
            Size = new Size(900, 700), MinimumSize = new Size(500, 350) };
        var text = new RichTextBox { Dock = DockStyle.Fill, ReadOnly = true, DetectUrls = false,
            Text = File.ReadAllText(filename), Font = new Font("Microsoft YaHei UI", 10), BackColor = SystemColors.Window };
        var openFolder = new Button { Text = "打开完整许可与字体源码目录", Dock = DockStyle.Bottom, Height = 42 };
        openFolder.Click += (_, _) => Process.Start(new ProcessStartInfo(folder) { UseShellExecute = true });
        dialog.Controls.Add(text); dialog.Controls.Add(openFolder);
        dialog.Show(this);
        return new { opened = true };
    }
}
