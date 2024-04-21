import { z } from "zod";
import $ from "jquery";
import { CloudlinkClient } from "@williamhorning/cloudlink";
import "./style.scss";
import { Modal } from "bootstrap";

const LOGIN_SCHEMA = z
  .object({
    cmd: z.literal("direct"),
    listener: z.literal("login"),
    val: z.object({
      mode: z.literal("auth"),
      payload: z.object({
        token: z.string(),
      }),
    }),
  })
  .or(
    z.object({
      cmd: z.literal("statuscode"),
      listener: z.literal("login"),
      val: z.string(),
    })
  );

let token: string;

const cloudlink = new CloudlinkClient({
  log: true,
  url: "wss://server.meower.org",
});
setInterval(() => {
  if (cloudlink.status === 1) {
    cloudlink.send({
      cmd: "ping",
      val: "",
    });
  }
}, 20000);
const onOpen = (callback: () => void) => {
  if (cloudlink.status === 1) {
    callback();
  }
  cloudlink.on("open", callback);
};

$("#login-form").on("submit", function (e) {
  e.preventDefault();
  const form = $(this);
  const username = form.find("[name=username]").val();
  const password = form.find("[name=password]").val();
  onOpen(() => {
    cloudlink.send({
      cmd: "direct",
      val: {
        cmd: "authpswd",
        val: {
          username,
          pswd: password,
        },
      },
      listener: "login",
    });
    const info = form.find(".info");
    info.removeClass("text-danger");
    info.text("Loading...");
    let found = false;
    cloudlink.on("packet", (packet: unknown) => {
      if (found) return;
      const parsed = LOGIN_SCHEMA.safeParse(packet);
      if (!parsed.success) return;
      found = true;
      if (typeof parsed.data.val === "string") {
        info.text(parsed.data.val);
        info.addClass("text-danger");
        return;
      }
      token = parsed.data.val.payload.token;
      loggedIn();
    });
  });
});

const loggedIn = () => {
  Modal.getInstance("#login-modal")?.hide();
};
