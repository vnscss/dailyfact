#!/bin/bash

# Get the directory of the current script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Go to repo root
cd "$SCRIPT_DIR/.."

# Load .env variables
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$' | xargs)
else
    echo "No .env file found at $ENV_FILE"
    exit 1
fi

# Ensure GIT_PAT is set
if [ -z "$GIT_PAT" ]; then
    echo "GIT_PAT is not set in .env"
    exit 1
fi

# Replace remote URL to include PAT (HTTPS)
REMOTE_URL=$(git remote get-url origin)
# Assuming HTTPS, insert PAT
REMOTE_URL_WITH_PAT=$(echo "$REMOTE_URL" | sed -E "s#https://#https://$GIT_PAT:@#")

# Force pull latest changes using PAT
echo "Pulling latest changes from git..."
git pull "$REMOTE_URL_WITH_PAT" --force

retry_count=0

while [ $retry_count -lt $MAX_RETRIES ]; do
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Run Node.js script
    output=$(node "$SCRIPT_DIR../../$NODE_SCRIPT" -- $NODE_FLAGS 2>&1)
    exit_code=$?

    if [ $exit_code -ne 0 ] || echo "$output" | grep -q '"error"'; then
        echo "[$timestamp] Node.js script failed or returned error."
        echo "$output"
        ((retry_count++))
        echo "Retrying in $SLEEP_TIME seconds... (Attempt $retry_count/$MAX_RETRIES)"
        sleep $SLEEP_TIME
        continue
    fi

    # Wrap output in HTML
    cat > "$SCRIPT_DIR/../$OUTPUT_FILE" <<EOF
<script type="application/json" id="daily-fact">
$output
</script>
<script defer src="./scripts/index.js"></script>
<link rel="stylesheet" href="./styles/styles.css">
EOF

    echo "[$timestamp] Output saved to $OUTPUT_FILE"

    # Add, commit, push using PAT
    git add "$OUTPUT_FILE"
    git commit -m "Update daily fact generated on $timestamp"
    echo "Pushing changes to git..."
    git push "$REMOTE_URL_WITH_PAT" --force

    exit 0
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failed after $MAX_RETRIES attempts."
exit 1
