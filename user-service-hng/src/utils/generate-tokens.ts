import jwt from "jsonwebtoken";

export type TokenPayload = { userId: string; role?: string };

export const generateTokens = (payload: TokenPayload) => {
  const accessToken = jwt.sign(
    { userId: payload.userId, role: payload.role },
    process.env.ACCESS_SECRET!,
    {
      expiresIn: "15m",
    }
  );
  const refreshToken = jwt.sign(
    { userId: payload.userId, role: payload.role },
    process.env.REFRESH_SECRET!,
    {
      expiresIn: "7d",
    }
  );
  return { accessToken, refreshToken };
};
