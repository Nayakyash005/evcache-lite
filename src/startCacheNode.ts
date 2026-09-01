import { start } from "./cacheNodeServer.js";
const port = Number(process.argv[2]) || 3001;
if (!port) {
  console.error("Port number is required as a command line argument");
}
start(port).then(() => {
  console.log(`Cache node server started on port ${port}`);
});
