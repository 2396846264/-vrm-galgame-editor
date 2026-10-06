namespace VRMGalgame;

internal enum UnsavedCloseChoice { Cancel, Save, Discard }
internal sealed class UnsavedCloseDialog : Form
{
    internal UnsavedCloseChoice Choice { get; private set; } = UnsavedCloseChoice.Cancel;
    private readonly Button save, discard, cancel;
    internal UnsavedCloseDialog(string text)
    {
        Text="未保存的修改";ClientSize=new Size(540,190);FormBorderStyle=FormBorderStyle.FixedDialog;
        MaximizeBox=false;MinimizeBox=false;ShowInTaskbar=false;StartPosition=FormStartPosition.CenterParent;
        AutoScaleMode=AutoScaleMode.Font;Font=new Font("Microsoft YaHei UI",10);
        var layout=new TableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(20),ColumnCount=1,RowCount=2};
        layout.RowStyles.Add(new RowStyle(SizeType.Percent,100));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,44));
        layout.Controls.Add(new Label{Text=text,Dock=DockStyle.Fill,AutoSize=false,TextAlign=ContentAlignment.MiddleLeft},0,0);
        var buttons=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.RightToLeft,WrapContents=false};
        cancel=new Button{Text="取消",Width=108,Height=36,Margin=new Padding(8,4,0,0)};
        discard=new Button{Text="直接关闭",Width=120,Height=36,Margin=new Padding(8,4,0,0)};
        save=new Button{Text="保存并关闭",Width=140,Height=36,Margin=new Padding(8,4,0,0)};
        cancel.Click+=(_,_)=>Finish(UnsavedCloseChoice.Cancel);discard.Click+=(_,_)=>Finish(UnsavedCloseChoice.Discard);save.Click+=(_,_)=>Finish(UnsavedCloseChoice.Save);
        buttons.Controls.AddRange([cancel,discard,save]);layout.Controls.Add(buttons,0,1);Controls.Add(layout);
        CancelButton=cancel;AcceptButton=save;Shown+=(_,_)=>cancel.Focus();
    }
    private void Finish(UnsavedCloseChoice choice){Choice=choice;DialogResult=choice==UnsavedCloseChoice.Cancel?DialogResult.Cancel:DialogResult.OK;Close();}
    internal void ChooseForSmoke(UnsavedCloseChoice choice)=>(choice==UnsavedCloseChoice.Save?save:choice==UnsavedCloseChoice.Discard?discard:cancel).PerformClick();
}
