import moment from "moment";
import { compact, noop } from "lodash";
import {
  onButtonPressed,
  onButtonReleased,
  onButtonDoubleClick,
  display,
  getCurrentStatus,
  onCameraCapture,
} from "../../device/display";
import {
  recordAudio,
  recordAudioManually,
  recordFileFormat,
  getDynamicVoiceDetectLevel,
  stopRecording,
} from "../../device/audio";
import { chatWithLLMStream } from "../../cloud-api/server";
import { isImMode } from "../../cloud-api/llm";
import { getSystemPromptWithKnowledge } from "../Knowledge";
import { enableRAG } from "../../cloud-api/knowledge";
import { cameraDir } from "../../utils/dir";
import {
  clearPendingCapturedImgForChat,
  getLatestGenImg,
  getLatestDisplayImg,
  setLatestCapturedImg,
  setPendingCapturedImgForChat,
} from "../../utils/image";
import { sendWhisplayIMMessage } from "../../cloud-api/whisplay-im/whisplay-im";
import { ChatFlowContext, FlowName, FlowStateHandler } from "./types";
import {
  enterCameraMode,
  handleCameraModePress,
  handleCameraModeRelease,
  onCameraModeExit,
  resetCameraModeControl,
} from "./camera-mode";

export const flowStates: Record<FlowName, FlowStateHandler> = {
  sleep: (ctx: ChatFlowContext) => {
    onButtonPressed(() => {
      resetCameraModeControl();
      ctx.buttonPressStartTime = Date.now();
      ctx.transitionTo("listening");
    });
    onButtonReleased(noop);
    onCameraModeExit(null);
    if (ctx.enableCamera) {
      const captureImgPath = `${cameraDir}/capture-${moment().format(
        "YYYYMMDD-HHmmss",
      )}.jpg`;
      onButtonDoubleClick(() => {
        enterCameraMode(captureImgPath);
        ctx.transitionTo("camera");
      });
    }
    display({
      status: "idle",
      emoji: "😴",
      RGB: "#000055",
      rag_icon_visible: false,
      ...(getCurrentStatus().text === "Listening..."
        ? {
          text: `Tap for conversation, hold for push-to-talk${ctx.enableCamera ? ",\ndouble click to launch camera" : ""
            }.`,
        }
        : {}),
    });
  },
  camera: (ctx: ChatFlowContext) => {
    onButtonDoubleClick(null);
    onButtonPressed(() => {
      handleCameraModePress();
    });
    onButtonReleased(() => {
      handleCameraModeRelease();
    });
    onCameraCapture(() => {
      const captureImagePath = getCurrentStatus().capture_image_path;
      if (!captureImagePath) {
        return;
      }
      setLatestCapturedImg(captureImagePath);
      setPendingCapturedImgForChat(captureImagePath);
      display({ image_icon_visible: true });
    });
    onCameraModeExit(() => {
      if (ctx.currentFlowName === "camera") {
        ctx.transitionTo("sleep");
      }
    });
    display({
      status: "camera",
      emoji: "📷",
      RGB: "#00ff88",
    });
  },
  listening: (ctx: ChatFlowContext) => {
    const TAP_THRESHOLD_MS = 500;
    ctx.isFromWakeListening = false;
    ctx.answerId += 1;
    ctx.wakeSessionActive = false;
    ctx.endAfterAnswer = false;
    ctx.currentRecordFilePath = `${ctx.recordingsDir
      }/user-${Date.now()}.${recordFileFormat}`;
    onButtonPressed(noop);
    const { result, stop } = recordAudioManually(ctx.currentRecordFilePath);
    let tapped = false;
    onButtonReleased(() => {
      const pressDuration = Date.now() - ctx.buttonPressStartTime;
      stop();
      if (pressDuration < TAP_THRESHOLD_MS) {
        tapped = true;
        ctx.conversationModeActive = true;
        ctx.transitionTo("conversation_listening");
      } else {
        ctx.conversationModeActive = false;
        display({
          RGB: "#ff6800",
          image: "",
        });
      }
    });
    result
      .then(() => {
        if (!tapped) {
          ctx.transitionTo("asr");
        }
      })
      .catch((err) => {
        if (!tapped) {
          console.error("Error during recording:", err);
          ctx.transitionTo("sleep");
        }
      });
    display({
      status: "listening",
      emoji: "😐",
      RGB: "#00ff00",
      text: "Listening...",
      rag_icon_visible: false,
    });
  },
  wake_listening: (ctx: ChatFlowContext) => {
    ctx.isFromWakeListening = true;
    ctx.answerId += 1;
    ctx.currentRecordFilePath = `${ctx.recordingsDir
      }/user-${Date.now()}.${recordFileFormat}`;
    onButtonPressed(() => {
      ctx.transitionTo("listening");
    });
    onButtonReleased(noop);
    display({
      status: "detecting",
      emoji: "😐",
      RGB: "#00ff00",
      text: "Detecting voice level...",
      rag_icon_visible: false,
    });
    getDynamicVoiceDetectLevel().then((level) => {
      display({
        status: "listening",
        emoji: "😐",
        RGB: "#00ff00",
        text: `(Detect level: ${level}%) Listening...`,
        rag_icon_visible: false,
      });
      recordAudio(ctx.currentRecordFilePath, ctx.wakeRecordMaxSec, level)
        .then(() => {
          ctx.transitionTo("asr");
        })
        .catch((err) => {
          console.error("Error during auto recording:", err);
          ctx.endWakeSession();
          ctx.transitionTo("sleep");
        });
    });
  },
  conversation_listening: (ctx: ChatFlowContext) => {
    ctx.isFromWakeListening = ctx.wakeSessionActive;
    ctx.answerId += 1;
    
    if (!ctx.wakeSessionActive) {
      ctx.endAfterAnswer = false;
    }
    
    ctx.currentRecordFilePath = `${ctx.recordingsDir
      }/user-${Date.now()}.${recordFileFormat}`;
    
    let recordingStarted = false;
    let stoppedByUser = false;
    
    onButtonPressed(() => {
      if (recordingStarted) {
        stoppedByUser = true;
        stopRecording();
      }
    });
    onButtonReleased(noop);
    
    display({
      status: "detecting",
      emoji: "😐",
      RGB: "#00ff00",
      text: "Detecting voice level...",
      rag_icon_visible: false,
    });
    
    getDynamicVoiceDetectLevel().then((level) => {
      recordingStarted = true;
      display({
        status: "listening",
        emoji: "😐",
        RGB: "#00ff00",
        text: "Tap to stop, or pause 1s...",
        rag_icon_visible: false,
      });
      recordAudio(ctx.currentRecordFilePath, ctx.wakeRecordMaxSec, level)
        .then(() => {
          ctx.transitionTo("asr");
        })
        .catch((err) => {
          if (stoppedByUser) {
            ctx.transitionTo("asr");
            return;
          }
          console.error("Error during conversation recording:", err);
          if (ctx.wakeSessionActive) {
            ctx.endWakeSession();
          }
          ctx.conversationModeActive = false;
          ctx.transitionTo("sleep");
        });
    });
  },
  asr: (ctx: ChatFlowContext) => {
    display({
      status: "recognizing",
    });
    onButtonDoubleClick(null);
    Promise.race([
      ctx.recognizeAudio(ctx.currentRecordFilePath, ctx.isFromWakeListening),
      new Promise<string>((resolve) => {
        onButtonPressed(() => {
          resolve("[UserPress]");
        });
        onButtonReleased(noop);
      }),
    ]).then((result) => {
      if (ctx.currentFlowName !== "asr") return;
      if (result === "[UserPress]") {
        ctx.transitionTo("listening");
        return;
      }
      if (result) {
        console.log("Audio recognized result:", result);
        ctx.asrText = result;
        ctx.endAfterAnswer = ctx.shouldEndAfterAnswer(result);
        if (ctx.wakeSessionActive) {
          ctx.wakeSessionLastSpeechAt = Date.now();
        }
        display({ status: "recognizing", text: result });
        ctx.transitionTo("answer");
        return;
      }
      if (ctx.wakeSessionActive) {
        if (ctx.shouldContinueWakeSession()) {
          ctx.transitionTo("conversation_listening");
        } else {
          ctx.endWakeSession();
          ctx.transitionTo("sleep");
        }
        return;
      }
      if (ctx.conversationModeActive) {
        ctx.transitionTo("conversation_listening");
        return;
      }
      ctx.transitionTo("sleep");
    });
  },
  answer: (ctx: ChatFlowContext) => {
    display({
      status: "answering...",
      RGB: "#00c8a3",
    });
    const currentAnswerId = ctx.answerId;
    if (isImMode) {
      const prompt: {
        role: "system" | "user";
        content: string;
      }[] = [
          {
            role: "user",
            content: ctx.asrText,
          },
        ];
      sendWhisplayIMMessage(prompt)
        .then((ok) => {
          if (ok) {
            display({
              status: "idle",
              emoji: "🦞",
              RGB: "#000055",
            });
          } else {
            display({
              status: "error",
              emoji: "⚠️",
              text: "OpenClaw send failed",
            });
          }
        })
        .finally(() => {
          ctx.transitionTo("sleep");
        });
      return;
    }
    onButtonPressed(() => {
      ctx.transitionTo("listening");
    });
    onButtonReleased(noop);
    const {
      partial,
      endPartial,
      getPlayEndPromise,
      stop: stopPlaying,
    } = ctx.streamResponser;
    ctx.partialThinking = "";
    ctx.thinkingSentences = [];
    [() => Promise.resolve().then(() => ""), getSystemPromptWithKnowledge]
    [enableRAG ? 1 : 0](ctx.asrText)
      .then((res: string) => {
        let knowledgePrompt = res;
        if (res) {
          console.log("Retrieved knowledge for RAG:\n", res);
        }
        if (ctx.knowledgePrompts.includes(res)) {
          console.log(
            "[RAG] Knowledge prompt already used in this session, skipping to avoid repetition.",
          );
          knowledgePrompt = "";
        }
        if (knowledgePrompt) {
          ctx.knowledgePrompts.push(knowledgePrompt);
        }
        display({
          rag_icon_visible: Boolean(enableRAG && knowledgePrompt),
        });
        const prompt: {
          role: "system" | "user";
          content: string;
        }[] = compact([
          knowledgePrompt
            ? {
              role: "system",
              content: knowledgePrompt,
            }
            : null,
          {
            role: "user",
            content: ctx.asrText,
          },
        ]);
        chatWithLLMStream(
          prompt,
          (text) => currentAnswerId === ctx.answerId && partial(text),
          () => currentAnswerId === ctx.answerId && endPartial(),
          (partialThinking) =>
            currentAnswerId === ctx.answerId &&
            ctx.partialThinkingCallback(partialThinking),
          (functionName: string, result?: string) => {
            if (
              functionName === "generateImage" &&
              result?.startsWith("[success]")
            ) {
              const img = getLatestGenImg();
              if (img) {
                display({ image: img });
              }
            }
            if (result) {
              display({
                text: `[${functionName}]${result}`,
              });
            } else {
              display({
                text: `Invoking [${functionName}]... {count}s`,
              });
            }
          },
        );
      });
    getPlayEndPromise().then(() => {
      if (ctx.currentFlowName === "answer") {
        clearPendingCapturedImgForChat();
        display({ image_icon_visible: false });
        if (ctx.wakeSessionActive || ctx.conversationModeActive || ctx.endAfterAnswer) {
          if (ctx.endAfterAnswer) {
            ctx.endWakeSession();
            ctx.conversationModeActive = false;
            ctx.transitionTo("sleep");
          } else {
            ctx.transitionTo("conversation_listening");
          }
          return;
        }
        const img = getLatestDisplayImg();
        if (img) {
          ctx.transitionTo("image");
        } else {
          ctx.transitionTo("sleep");
        }
      }
    });
    onButtonPressed(() => {
      stopPlaying();
      clearPendingCapturedImgForChat();
      display({ image_icon_visible: false });
      ctx.transitionTo("listening");
    });
    onButtonReleased(noop);
  },
  image: (ctx: ChatFlowContext) => {
    onButtonPressed(() => {
      display({ image: "" });
      ctx.transitionTo("listening");
    });
    onButtonReleased(noop);
  },
  external_answer: (ctx: ChatFlowContext) => {
    if (!ctx.pendingExternalReply) {
      ctx.transitionTo("sleep");
      return;
    }
    display({
      status: "answering...",
      RGB: "#00c8a3",
      ...(ctx.pendingExternalEmoji ? { emoji: ctx.pendingExternalEmoji } : {}),
    });
    onButtonPressed(() => {
      ctx.streamResponser.stop();
      ctx.transitionTo("listening");
    });
    onButtonReleased(noop);
    const replyText = ctx.pendingExternalReply;
    const replyEmoji = ctx.pendingExternalEmoji;
    ctx.currentExternalEmoji = replyEmoji;
    ctx.pendingExternalReply = "";
    ctx.pendingExternalEmoji = "";
    void ctx.streamExternalReply(replyText, replyEmoji);
    ctx.streamResponser.getPlayEndPromise().then(() => {
      if (ctx.currentFlowName !== "external_answer") return;
      if (ctx.wakeSessionActive || ctx.conversationModeActive || ctx.endAfterAnswer) {
        if (ctx.endAfterAnswer) {
          ctx.endWakeSession();
          ctx.conversationModeActive = false;
          ctx.transitionTo("sleep");
        } else {
          ctx.transitionTo("conversation_listening");
        }
      } else {
        ctx.transitionTo("sleep");
      }
    });
  },
};
