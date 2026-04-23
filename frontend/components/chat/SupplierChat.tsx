"use client"

import { useState, useEffect, useRef } from "react"
import { Send, Menu, Search, Phone, MoreVertical, Paperclip, Smile, X, FileText, ImageIcon } from "lucide-react"
import { io, Socket } from "socket.io-client"

type Message = {
  sender: string
  content?: string
  file_url?: string
  file_name?: string
  file_type?: string
}

export function SupplierChat() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [roomId, setRoomId] = useState("100") // Default demo room
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [joined, setJoined] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showMedia, setShowMedia] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (!joined) return
    const newSocket = io("http://localhost:8000", { transports: ["websocket"] })

    newSocket.on("connect", () => {
      newSocket.emit("join_room_event", { room_id: roomId, role: "supplier" })
    })

    newSocket.on("receive_message", (data: Message) => {
      if (data.sender !== "System") {
        setMessages((prev) => [...prev, data])
      }
    })

    setSocket(newSocket)
    return () => { newSocket.disconnect() }
  }, [joined, roomId])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!socket || (!inputValue.trim() && !selectedFile)) return

    let uploadedFileUrl = undefined
    let uploadedFileName = undefined
    let uploadedFileType = undefined

    if (selectedFile) {
      const formData = new FormData()
      formData.append("file", selectedFile)
      try {
        const response = await fetch("http://localhost:8000/api/v1/chat/upload", {
          method: "POST",
          body: formData,
        })
        if (!response.ok) throw new Error("Upload response not OK")
        const result = await response.json()
        uploadedFileUrl = result.file_url
        uploadedFileName = result.file_name
        uploadedFileType = result.file_type
      } catch (error) {
        console.error("Upload failed", error)
        return
      }
    }

    const msgData = {
      room_id: roomId,
      sender: "Supplier",
      content: inputValue.trim(),
      file_url: uploadedFileUrl,
      file_name: uploadedFileName,
      file_type: uploadedFileType
    }

    socket.emit("send_message", msgData)
    setMessages((prev) => [...prev, msgData])
    setInputValue("")
    setSelectedFile(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
    }
    // reset explicitly to allow same file re-selection
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!joined) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#212121]">
        <button onClick={() => setJoined(true)} className="rounded-full bg-[#8774e1] px-10 py-4 text-white hover:bg-[#7261cc]">
          Open Telegram Web
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0f0f0f] text-white font-sans">
      {/* Sidebar - Telegram aesthetic */}
      <div className={`w-[350px] flex-col border-r border-[#212121] bg-[#1c1c1d] ${sidebarOpen ? "flex" : "hidden"}`}>
        <div className="flex items-center gap-4 px-4 h-14">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white"><Menu className="size-6" /></button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search" 
              className="w-full rounded-full bg-[#2c2c2e] py-1.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none"
              readOnly
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Active Chat Item */}
          <div className="flex cursor-pointer items-center gap-3 bg-[#8774e1] px-4 py-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-[#3b82f6] text-lg font-bold">
              M
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex justify-between">
                <span className="font-medium text-white truncate">Merchant Team</span>
                <span className="text-xs text-[#e5e5ea]">12:00</span>
              </div>
              <p className="truncate text-sm text-[#e5e5ea]">Negotiation terms received</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col relative bg-[#181818] bg-[url('https://web.telegram.org/a/chat-bg-pattern-dark.png')] bg-repeat bg-[length:400px]">
        {/* Overlay to dim background */}
        <div className="absolute inset-0 bg-[#0f0f0f]/80 pointer-events-none z-0"></div>

        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-[#2c2c2e] bg-[#1c1c1d] px-4 z-10 w-full">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white mr-2">
                <Menu className="size-6" />
              </button>
            )}
            <div className="flex size-10 items-center justify-center rounded-full bg-[#3b82f6] text-sm font-bold">M</div>
            <div>
              <h2 className="font-medium tracking-wide">Merchant Team</h2>
              <p className="text-xs text-[#8774e1]">online</p>
            </div>
          </div>
          <div className="flex gap-4 text-gray-400">
            <Search className="size-5 hover:text-white cursor-pointer" />
            <Phone className="size-5 hover:text-white cursor-pointer" />
            <MoreVertical onClick={() => setShowMedia(!showMedia)} className="size-5 hover:text-white cursor-pointer" />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-[15%] py-6 space-y-4 z-10">
          <div className="flex justify-center mb-6">
            <span className="bg-[#212121]/80 px-3 py-1 rounded-full text-xs font-medium text-gray-400 border border-[#2c2c2e]">
              Today
            </span>
          </div>

          <div className="flex justify-start">
            <div className="bg-[#212121] text-white px-4 py-2.5 rounded-2xl rounded-bl-none shadow-sm max-w-[70%]">
              <span className="text-[11px] text-blue-400 block mb-1">Merchant Team</span>
              Hello, this is the Merchant team reaching out regarding your latest bulk quote. We'd like to negotiate the unit price.
            </div>
          </div>

          {messages.map((msg, idx) => {
            const isMe = msg.sender === "Supplier"
            return (
              <div key={idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div 
                  className={`px-4 py-2.5 rounded-2xl shadow-sm max-w-[80%] break-words flex flex-col gap-1 ${
                    isMe 
                      ? "bg-[#8774e1] text-white rounded-br-none" 
                      : "bg-[#212121] text-white rounded-bl-none"
                  }`}
                >
                  {!isMe && <span className="text-[11px] text-blue-400">{msg.sender}</span>}
                  
                  {msg.file_url && (
                    <div className="mb-1 mt-1">
                      {msg.file_type?.startsWith("image/") ? (
                        <img src={msg.file_url} alt={msg.file_name || "image"} className="max-w-[200px] h-auto rounded-lg object-cover" />
                      ) : (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-[#2c2c2e] p-2 rounded-lg hover:bg-[#3c3c3e] transition-colors">
                          <FileText className="size-5 text-[#8774e1]" />
                          <span className="text-sm truncate max-w-[150px]" title={msg.file_name}>{msg.file_name}</span>
                        </a>
                      )}
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="bg-[#1c1c1d] p-3 z-10 flex flex-col items-center w-full shadow-[0_-5px_20px_rgba(0,0,0,0.2)]">
          {selectedFile && (
            <div className="w-[70%] max-w-4xl flex items-center justify-between bg-[#2c2c2e] p-3 rounded-lg mb-2">
              <div className="flex items-center gap-3 text-white overflow-hidden">
                {selectedFile.type.startsWith("image/") ? <ImageIcon className="size-5 text-blue-400 flex-shrink-0" /> : <FileText className="size-5 text-red-400 flex-shrink-0" />}
                <span className="text-sm truncate">{selectedFile.name}</span>
              </div>
              <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-white p-1 ml-2">
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="w-[70%] max-w-4xl flex items-end gap-2">
            <div className="flex flex-1 items-end rounded-2xl bg-[#212121] pl-2 pr-1 py-1 relative">
              <input type="file" hidden ref={fileInputRef} accept="image/*,.pdf" onChange={handleFileChange} />
              
              <button className="p-2 text-gray-400 hover:text-white">
                <Smile className="size-6" />
              </button>
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as any);
                  }
                }}
                placeholder="Write a message..."
                className="max-h-32 min-h-[44px] w-full resize-none bg-transparent px-2 py-2.5 text-[15px] outline-none text-white overflow-y-auto"
                rows={1}
              />
              <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-white">
                <Paperclip className="size-6" />
              </button>
            </div>
            
            {inputValue.trim() || selectedFile ? (
              <button 
                onClick={handleSend}
                className="flex size-14 items-center justify-center rounded-full bg-[#8774e1] text-white shadow hover:bg-[#7261cc]"
              >
                <Send className="size-6 ml-1" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Right Media Sidebar */}
      {showMedia && (
        <div className="w-[300px] flex-col border-l border-[#212121] bg-[#1c1c1d] flex z-20">
          <div className="flex items-center gap-4 px-4 h-14 border-b border-[#2c2c2e]">
            <button onClick={() => setShowMedia(false)} className="text-gray-400 hover:text-white">
              <X className="size-5" />
            </button>
            <h2 className="font-medium tracking-wide">Shared Media</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.filter(m => m.file_url).length === 0 ? (
              <p className="text-sm text-gray-500 text-center mt-10">No media shared yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {messages.filter(m => m.file_url).map((msg, idx) => (
                  <div key={idx} className="aspect-square bg-[#2c2c2e] rounded-lg overflow-hidden flex items-center justify-center relative group p-2">
                    {msg.file_type?.startsWith("image/") ? (
                      <img src={msg.file_url} alt={msg.file_name || "image"} className="w-full h-full object-cover cursor-pointer rounded" onClick={() => window.open(msg.file_url, "_blank")} />
                    ) : (
                      <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center p-2 text-center text-xs text-gray-300 hover:text-white w-full h-full justify-center">
                        <FileText className="size-8 text-[#8774e1] mb-2" />
                        <span className="truncate w-full px-1" title={msg.file_name}>{msg.file_name}</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
