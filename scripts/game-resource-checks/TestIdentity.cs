namespace VRMGalgame;
// Test-only identity. Official build secrets are never required by source CI.
internal static class ProtectedBuildConstants
{
    internal static string Identity = "test identity A";
    internal static string ArchivePassword() => Identity;
}
