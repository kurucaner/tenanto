```js
const limitedInfoShownRef = useRef(false);

const pickFromPhotos = useCallback(async (mediaKind: MediaKind): Promise<IAttachedFile[]> => {
  const isVideo = mediaKind === "video";
  const mediaTypes: ImagePicker.MediaType[] = isVideo ? ["videos"] : ["images"];
  const fallbackMime = isVideo ? "video/mp4" : "image/jpeg";
  const allowsMultiple = !isVideo;

  if (Platform.OS === "ios" && isVideo) {
    const { granted, accessPrivileges } = await ensureMediaPermissionForVideos();

    if (!granted || accessPrivileges === "none") {
      Alert.alert(
        "Permission required",
        "Permission to access your photo library is required to add videos."
      );
      return [];
    }

    if (accessPrivileges === "limited" && !limitedInfoShownRef.current) {
      limitedInfoShownRef.current = true;
      Alert.alert(
        "Limited Access Enabled",
        "iOS may show a limited photo selection screen first. After this step, video selection will open normally."
      );
      // Option A: return [] so user taps again (most deterministic UX)
      // return [];
      // Option B: continue immediately (current behavior, but explained to user)
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: allowsMultiple,
    mediaTypes,
  });

  if (result.canceled || result.assets.length === 0) return [];
  return result.assets.map((a, i) => ({
    mimeType: a.mimeType ?? fallbackMime,
    name: a.fileName ?? `file-${i + 1}`,
    size: a.fileSize ?? 0,
    uri: a.uri,
  }));
}, []);
```
