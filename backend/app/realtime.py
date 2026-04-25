try:
    import socketio  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    socketio = None


# Socket.IO setup
sio = (
    socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
    if socketio is not None
    else None
)
