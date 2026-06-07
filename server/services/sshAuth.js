export async function createSshAuthConfig(connection, vault) {
  const secret = await vault.getSecret(connection.credentialId);

  if (!secret) {
    throw new Error("未找到连接凭据");
  }

  const baseConfig = {
    host: connection.host,
    port: connection.port,
    username: connection.username,
    readyTimeout: 15000,
    keepaliveInterval: 10000
  };

  if (connection.authType === "privateKey") {
    if (secret.type !== "privateKey" || !secret.privateKey) {
      throw new Error("私钥凭据无效");
    }

    return {
      ...baseConfig,
      privateKey: secret.privateKey,
      ...(secret.passphrase ? { passphrase: secret.passphrase } : {})
    };
  }

  if (secret.type !== "password" || !secret.password) {
    throw new Error("密码凭据无效");
  }

  return {
    ...baseConfig,
    password: secret.password
  };
}
