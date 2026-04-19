export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { name, email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    // TODO: replace with DB logic
    const user = {
      id: Date.now(),
      name,
      email
    };

    return res.status(201).json({
      message: "User registered successfully",
      user
    });

  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
}