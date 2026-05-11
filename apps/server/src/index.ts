import express from "express"
import cors from "cors"
import { createApiRouter } from "./routes"
import { createContext } from "./context"
import { errorHandler } from "./middleware/error"

const app = express()
const PORT = process.env.PORT || 3000
const ctx = createContext()

app.use(cors())
app.use(express.json())

app.use("/api", createApiRouter(ctx))
app.use(errorHandler)

app.listen(PORT, async () => {
  console.log(`[FRP Manager] Server running on http://localhost:${PORT}`)
  console.log(`[FRP Manager] Profile path: ${ctx.profileService.getPath()}`)
  const profile = await ctx.getProfile()
  if (profile) {
    console.log(`[FRP Manager] Config path: ${profile.configPath}`)
    console.log(`[FRP Manager] Reload strategy: ${profile.reload.type}`)
  } else {
    console.log(`[FRP Manager] No profile configured — open web UI to set up`)
  }
})
