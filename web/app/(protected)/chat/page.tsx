import { Header } from '@/components/layout';
import { ChatContainer } from '@/components/chat';

export default function ChatPage() {
  return (
    <>
      <Header title="Chat" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatContainer />
      </div>
    </>
  );
}
