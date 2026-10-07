import ImageKit, { toFile } from "@imagekit/nodejs";


const imageKit = new ImageKit({ privateKey: process.env.IMAGEKIT_PRIVATE_KEY });

function hasImageKitConfig() {
    return Boolean(process.env.IMAGEKIT_PRIVATE_KEY);

}

// originalName = "My Photo (1).png"
// result : "chat-17493000000-My_Photo__1.png"
// this helper makes a safe, unique filename for uploaded files.
function createFileName(originalName = "upload") {
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `chat -${Date.now()}-${safeName}`;


}
/**
 * upload image or video to ImageKi
 * @see https://imagekit.io/docs/api-reference/upload-file/upload-file
 */
async function uploadChatMedia(file) {
    const fileName = createFileName(file.originalName);
    const result = await imageKit.files.upload({
        file: await toFile(file.buffer, fileName, { type: file.mimetype }),
        fileName,
        folder: "/chat",
    });

    return result.url;

}
export { uploadChatMedia, hasImageKitConfig}