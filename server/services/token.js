import crypto from "node:crypto";

export function createRuntimeToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function getTokenFromRequest(req) {
  const queryToken = req.query?.token;
  if (typeof queryToken === "string" && queryToken.length > 0) {
    return queryToken;
  }

  const headerToken = req.headers?.["x-magic-ssh-token"];
  if (typeof headerToken === "string" && headerToken.length > 0) {
    return headerToken;
  }

  const authorization = req.headers?.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  return "";
}

export function createTokenGuard(expectedToken) {
  return (req, res, next) => {
    if (getTokenFromRequest(req) !== expectedToken) {
      res.status(401).json({ error: "token 无效或已缺失" });
      return;
    }

    next();
  };
}
