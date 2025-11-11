import Editor from "@monaco-editor/react";
import { Loader2Icon, PlayIcon, UsersIcon } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";
import { LANGUAGE_CONFIG } from "../data/problems";

/**
 * CodeEditorPanel Component with Real-time Collaboration
 * 
 * Features:
 * - Real-time code synchronization between multiple users
 * - Debounced code changes to prevent excessive socket emissions
 * - Remote edit handling without causing infinite loops
 * - Support for language switching across all users
 * - Active users indicator
 */
function CodeEditorPanel({
  selectedLanguage,
  code,
  isRunning,
  onLanguageChange,
  onCodeChange,
  onRunCode,
  socket, // Socket.IO instance
  roomId, // Session/room ID
  userId, // Current user ID
  activeUsers = [], // List of active users in the room
}) {
  const editorRef = useRef(null);
  const isRemoteChangeRef = useRef(false); // Flag to prevent echo
  const debounceTimerRef = useRef(null);

  /**
   * Handle editor mount - store reference for remote updates
   */
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  /**
   * Handle local code changes with debouncing
   */
  const handleCodeChange = useCallback(
    (value) => {
      // Don't emit if this change came from a remote update
      if (isRemoteChangeRef.current) {
        isRemoteChangeRef.current = false;
        return;
      }

      // Update local state immediately
      onCodeChange(value);

      // Debounce socket emission to prevent excessive network traffic
      if (socket?.connected && roomId && userId) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          socket.emit("code-change", {
            roomId,
            code: value,
            language: selectedLanguage,
            userId,
          });
        }, 300); // 300ms debounce delay
      }
    },
    [onCodeChange, socket, roomId, userId, selectedLanguage]
  );

  /**
   * Listen for remote code updates from other users
   */
  useEffect(() => {
    if (!socket) return;

    const handleCodeUpdate = ({ code: remoteCode, language, userId: remoteUserId }) => {
      // Ignore updates from self
      if (remoteUserId === userId) return;

      // Set flag to prevent echo
      isRemoteChangeRef.current = true;

      // Update the code state
      onCodeChange(remoteCode);

      // Update editor directly for smoother UX
      if (editorRef.current) {
        const currentPosition = editorRef.current.getPosition();
        editorRef.current.setValue(remoteCode);
        
        // Try to restore cursor position
        if (currentPosition) {
          editorRef.current.setPosition(currentPosition);
        }
      }
    };

    const handleLanguageUpdate = ({ language, userId: remoteUserId }) => {
      if (remoteUserId === userId) return;
      
      // Create a synthetic event for language change
      const syntheticEvent = {
        target: { value: language },
      };
      onLanguageChange(syntheticEvent);
    };

    // Register socket listeners
    socket.on("code-update", handleCodeUpdate);
    socket.on("language-update", handleLanguageUpdate);

    // Cleanup listeners on unmount
    return () => {
      socket.off("code-update", handleCodeUpdate);
      socket.off("language-update", handleLanguageUpdate);
    };
  }, [socket, userId, onCodeChange, onLanguageChange]);

  /**
   * Handle language change and notify other users
   */
  const handleLanguageChangeWithSync = (e) => {
    const newLang = e.target.value;
    onLanguageChange(e);

    // Emit language change to other users
    if (socket?.connected && roomId && userId) {
      socket.emit("language-change", {
        roomId,
        language: newLang,
        userId,
      });
    }
  };

  /**
   * Cleanup debounce timer on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="h-full bg-base-300 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-base-100 border-t border-base-300">
        <div className="flex items-center gap-3">
          <img
            src={LANGUAGE_CONFIG[selectedLanguage].icon}
            alt={LANGUAGE_CONFIG[selectedLanguage].name}
            className="size-6"
          />
          <select 
            className="select select-sm" 
            value={selectedLanguage} 
            onChange={handleLanguageChangeWithSync}
          >
            {Object.entries(LANGUAGE_CONFIG).map(([key, lang]) => (
              <option key={key} value={key}>
                {lang.name}
              </option>
            ))}
          </select>

          {/* Active users indicator */}
          {activeUsers.length > 0 && (
            <div className="flex items-center gap-2 ml-4 text-sm text-base-content/60">
              <UsersIcon className="size-4" />
              <span>{activeUsers.length} active</span>
            </div>
          )}
        </div>

        <button className="btn btn-primary btn-sm gap-2" disabled={isRunning} onClick={onRunCode}>
          {isRunning ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <PlayIcon className="size-4" />
              Run Code
            </>
          )}
        </button>
      </div>

      <div className="flex-1">
        <Editor
          height={"100%"}
          language={LANGUAGE_CONFIG[selectedLanguage].monacoLang}
          value={code}
          onChange={handleCodeChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            fontSize: 16,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            minimap: { enabled: false },
            wordWrap: "on",
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>
    </div>
  );
}

export default CodeEditorPanel;

