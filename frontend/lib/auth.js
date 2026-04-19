import jwt from "jsonwebtoken";

export async function auth(req) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) throw new Error("Unauthorized");

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  return decoded; // { id, plan }
}