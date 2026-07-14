import type { ProfilePostResponse } from "@/lib/types";
import { PostCard } from "./PostCard";
import type { PostAuthor } from "./PostComposerDialog";

export type PostTimelineProps = {
  posts: ProfilePostResponse[];
  author?: PostAuthor | null;
  canManage?: boolean;
  onDeleted?: (id: string) => void;
  onUpdated?: (post: ProfilePostResponse) => void;
  onPinChanged?: (post: ProfilePostResponse) => void;
};

export function PostTimeline({
  posts,
  author,
  canManage = false,
  onDeleted,
  onUpdated,
  onPinChanged,
}: PostTimelineProps) {
  return (
    <ol className="space-y-3">
      {posts.map((post) => (
        <li key={post.id} data-post-id={post.id}>
          <PostCard
            post={post}
            author={author}
            canManage={canManage}
            onDeleted={onDeleted}
            onUpdated={onUpdated}
            onPinChanged={onPinChanged}
          />
        </li>
      ))}
    </ol>
  );
}
