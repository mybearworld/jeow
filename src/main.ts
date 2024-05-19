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
const POST_SCHEMA = z.object({
  p: z.string(),
  u: z.string(),
  attachments: z
    .object({
      filename: z.string(),
      id: z.string(),
    })
    .array(),
});
type Post = z.infer<typeof POST_SCHEMA>;
const CLOUDLINK_POST_SCHEMA = z.object({
  cmd: z.literal("direct"),
  val: POST_SCHEMA,
});
const HOME_SCHEMA = z.object({
  autoget: POST_SCHEMA.array(),
});

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
  $("#pre-logged-in").hide();
  $("#logged-in").show();
  const posts = $("#posts");
  const enterPost = $<HTMLFormElement>("#enter-post");
  const content = enterPost.find("[name=content]");
  cloudlink.on("packet", (packet: unknown) => {
    const parsed = CLOUDLINK_POST_SCHEMA.safeParse(packet);
    if (!parsed.success) return;
    posts.prepend(makePost(parsed.data.val));
  });
  content.on("keydown", async function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await post();
    }
  });
  const post = async () => {
    content.prop("disabled", true);
    await fetch("https://api.meower.org/home", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Token: token,
      },
      body: JSON.stringify({
        content: content.val(),
      }),
    });
    content.prop("disabled", false);
    content.val("");
    content[0].focus();
  };
  enterPost.on("submit", async function (e) {
    e.preventDefault();
    await post();
  });
  fetch("https://api.meower.org/home?autoget=1").then(async (response) => {
    HOME_SCHEMA.parse(await response.json()).autoget.forEach((post) =>
      posts.append(makePost(post))
    );
  });
};

const makePost = (post: Post) => {
  const template = $("#post-template > div").clone();
  if (post.u === "Discord") {
    const [user, ...content] = post.p.split(":");
    template.find(".username").text(user);
    template.find(".content").text(content.join(":"));
    template.find(".bridged").show();
  } else {
    template.find(".username").text(post.u);
    template.find(".content").text(post.p);
  }
  if (post.attachments) {
    const attachments = template.find(".attachments");
    attachments.show();
    post.attachments.forEach((attachment) => {
      const element = $("<img>");
      element.prop(
        "src",
        `https://uploads.meower.org/attachments/${attachment.id}/${attachment.filename}`
      );
      element.prop("style", "max-width: 100%");
      console.log(element);
      attachments.append(element);
    });
  }
  return template;
};
