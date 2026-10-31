// Read a real OTP from stdin without echo, files, command-line arguments or logs.
export function readOtp(input, timeoutMs = 9 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const wasRaw = input.isRaw === true;
    const cleanup = () => {
      clearTimeout(timer);
      input.removeListener("data", onData);
      input.removeListener("end", onEnd);
      input.removeListener("error", onError);
      input.pause();
      if (input.isTTY) input.setRawMode(wasRaw);
    };
    const finish = () => {
      const value = buffer.trim();
      cleanup();
      buffer = "";
      if (/^\d{6,10}$/.test(value)) resolve(value);
      else reject(new Error("invalid_otp_input"));
    };
    const onData = (chunk) => {
      buffer += chunk.toString();
      if (buffer.length > 32) {
        cleanup();
        buffer = "";
        reject(new Error("invalid_otp_input"));
      } else if (/[\r\n]/.test(buffer)) finish();
    };
    const onEnd = () => finish();
    const onError = () => {
      cleanup();
      buffer = "";
      reject(new Error("otp_input_unavailable"));
    };
    const timer = setTimeout(() => {
      cleanup();
      buffer = "";
      reject(new Error("otp_timeout"));
    }, timeoutMs);
    try {
      if (input.isTTY) input.setRawMode(true);
      input.on("data", onData);
      input.once("end", onEnd);
      input.once("error", onError);
      input.resume();
    } catch {
      onError();
    }
  });
}
