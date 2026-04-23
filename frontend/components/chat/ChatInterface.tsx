"use client"

import { useState, useEffect, useRef } from "react"
import { Send, User, Building2 } from "lucide-react"
import { io, Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type Message = {
  sender: string
  content: string
  timestamp?: string
}

export function ChatInterface() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [joined, setJoined] = useState(false)
  const [role, setRole] = useState<"merchant" | "supplier" | null>(null)
  const [roomId, setRoomId] = useState("")
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<Message[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (!joined || !roomId || !role) return

    // Connect to FastAPI Socket.IO
    const newSocket = io("http://localhost:8000", {
      transports: ["websocket"],
    })

    newSocket.on("connect", () => {
      newSocket.emit("join_room_event", { room_id: roomId, role })
    })

    newSocket.on("receive_message", (data: Message) => {
      setMessages((prev) => [...prev, data])
    })
    
    newSocket.on("message", (data: Message) => {
      setMessages((prev) => [...prev, data])
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [joined, roomId, role])

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (role && roomId.trim()) {
      setJoined(true)
    }
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!socket || !inputValue.trim()) return

    const messageData = {
      room_id: roomId,
      sender: role === "merchant" ? "Merchant" : "Supplier",
      content: inputValue.trim(),
    }

    socket.emit("send_message", messageData)
    setMessages((prev) => [...prev, messageData])
    setInputValue("")
  }

  if (!joined) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center p-4">
        <Card className="w-full max-w-md overflow-hidden rounded-2xl border border-[#243047] bg-[#111827]/80 shadow-2xl backdrop-blur-xl">
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-6 pb-4">
            <h2 className="text-2xl font-bold tracking-tight text-white">Join Negotiation</h2>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              Connect to a real-time discussion.
            </p>
          </div>
          <CardContent className="p-6 pt-4">
            <form onSubmit={handleJoin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Room ID</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="e.g. order-1234"
                  className="w-full rounded-xl border border-[#243047] bg-[#172033] px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Select Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("merchant")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 transition-all ${
                      role === "merchant"
                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                        : "border-[#243047] bg-[#172033] text-gray-400 hover:bg-[#1f2937]"
                    }`}
                  >
                    <User className="size-4" />
                    Merchant
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("supplier")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 transition-all ${
                      role === "supplier"
                        ? "border-purple-500 bg-purple-500/10 text-purple-400"
                        : "border-[#243047] bg-[#172033] text-gray-400 hover:bg-[#1f2937]"
                    }`}
                  >
                    <Building2 className="size-4" />
                    Supplier
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={!role || !roomId.trim()}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                Enter Chat Room
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-100px)] max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#243047] bg-[#111827]/90 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#243047] bg-[#172033] p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {role === "merchant" ? "Merchant Desk" : "Supplier Portal"}
          </h2>
          <p className="text-sm text-gray-400">
            Room: <span className="font-medium text-gray-300">{roomId}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-[#243047]/50 px-3 py-1">
            <span className="flex size-2 rounded-full bg-green-500"></span>
            <span className="text-xs font-medium text-gray-300">Connected</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => {
          const isSystem = msg.sender === "System"
          const isMe = msg.sender.toLowerCase() === role

          if (isSystem) {
            return (
              <div key={idx} className="flex justify-center my-4">
                <span className="rounded-full bg-gray-800/80 px-4 py-1 text-xs font-medium text-gray-400">
                  {msg.content}
                </span>
              </div>
            )
          }

          return (
            <div key={idx} className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
              <div className="flex max-w-[80%] flex-col gap-1">
                <span
                  className={`text-xs px-1 ${
                    isMe ? "text-right text-gray-400" : "text-left text-gray-400"
                  }`}
                >
                  {msg.sender}
                </span>
                <div
                  className={`rounded-2xl px-5 py-3 text-sm shadow-sm ${
                    isMe
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-[#1f2937] text-gray-100 rounded-bl-sm border border-[#374151]"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-[#243047] bg-[#172033] p-4">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="w-full rounded-xl border border-[#243047] bg-[#111827] pb-3 pl-4 pr-12 pt-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="flex shrink-0 items-center justify-center rounded-xl bg-blue-600 p-3 text-white transition-opacity hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="size-5" />
          </button>
        </form>
      </div>
    </div>
  )
}
