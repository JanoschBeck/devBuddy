import { display } from "./device/display";
import ChatFlow from "./core/ChatFlow";
import dotenv from "dotenv";
import dns from "dns";

dotenv.config();

const isNetworkConnected: () => Promise<boolean> = () => {
  return new Promise((resolve) => {
    dns.lookup("cloudflare.com", (err) => {
      if (err && err.code === "ENOTFOUND") {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

const intervalCheckNetwork = () => {
  setInterval(async () => {
    const connected = await isNetworkConnected();
    display({
      network_connected: connected,
    });
  }, 10000);
};
intervalCheckNetwork();

new ChatFlow({
  enableCamera: process.env.ENABLE_CAMERA === "true",
});
