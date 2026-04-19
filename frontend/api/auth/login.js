export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    // TODO: replace with DB check
    const fakeUser = {
      id: 1,
      email
    };

    return res.status(200).json({
      message: "Login successful",
      token: "fake-jwt-token",
      user: fakeUser
    });

  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
}