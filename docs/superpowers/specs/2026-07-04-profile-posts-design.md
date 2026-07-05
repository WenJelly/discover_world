# Profile Posts Design

## Goal

Build the backend MVP for personal-profile image/text posts: users can create, edit, delete, view, react to, favorite, and comment on posts, while the existing profile cursor list continues to render posts efficiently.

## Scope

The first version supports `public` and `private` posts, up to 9 image attachments, one-level comments, like toggles, favorite toggles, soft deletion, and cursor pagination. Follower-only visibility, reposting, topic feeds, recommendation feeds, moderation queues, and nested comment trees are intentionally deferred.

## Architecture

`post` remains the primary business table. Post images are linked through `asset_link` with `owner_type=post` and `link_role=attachment`. Interactions use existing generic tables: `reaction`, `favorite`, `comment_record`, and `entity_stat` with `target_type=post`.

The new `internal/logic/post` package owns post write operations, detail loading, interaction toggles, and comment flows. The existing `internal/logic/profile` package remains responsible for profile aggregation and cursor lists.

## Data Flow

Create and update operations validate the logged-in user, normalize content and visibility, parse image IDs, verify image ownership, then write `post`, `asset_link`, and `entity_stat`. Multi-table post writes use go-zero `sqlx.TransactCtx` through `ServiceContext.Transact`.

Read operations load posts first, then batch-load attachment IDs, media assets, media responses, and stats. This preserves the existing no-N+1 pattern in profile lists.

## Permissions

Owners and admins can manage a post. Public active posts are visible to everyone with a logged-in session. Private posts are visible only to the owner and admins. Deleted posts are hidden from all normal read paths.

## Error Handling

Validation failures return business `BadRequest` or `Forbidden` errors through the existing response helpers. Missing posts or images return `NotFound`. Database failures are wrapped as `InternalServerError`.

## Testing

Focused unit tests cover normalization rules, image ID parsing, post response assembly, and model query helper behavior. Logic and route wiring are verified with `go test ./internal/logic/post ./model` and then `go test ./...`.
