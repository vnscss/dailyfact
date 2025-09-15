#!/bin/bash

# Get the directory of the current script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Go to repo root (assuming script is inside a subfolder)
cd "$SCRIPT_DIR/.."

# Force pull latest changes
echo "Pulling latest changes from git..."
git pull --force

# Look for .env in the parent directory of the script
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
    # Load variables safely from .env (ignore comments and empty lines)
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$' | xargs)
else
    echo "No .env file found at $ENV_FILE"
    exit 1
fi

retry_count=0

while [ $retry_count -lt $MAX_RETRIES ]; do
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Run Node.js script with flags and capture output & exit code
    output=$(node "$SCRIPT_DIR../../$NODE_SCRIPT" -- $NODE_FLAGS 2>&1)
    exit_code=$?

    if [ $exit_code -ne 0 ]; then
        echo "[$timestamp] Node.js script failed (exit code $exit_code)."
        echo "[$timestamp] Output:"
        echo "$output"
        ((retry_count++))
        echo "Retrying in $SLEEP_TIME seconds... (Attempt $retry_count/$MAX_RETRIES)"
        sleep $SLEEP_TIME
        continue
    fi

    if echo "$output" | grep -q '"error"'; then
        echo "[$timestamp] Error key found in output."
        echo "[$timestamp] Output:"
        echo "$output"
        ((retry_count++))
        echo "Retrying in $SLEEP_TIME seconds... (Attempt $retry_count/$MAX_RETRIES)"
        sleep $SLEEP_TIME
    else
        # Wrap output in a JSON script tag inside HTML
        cat > "$SCRIPT_DIR/../$OUTPUT_FILE" <<EOF
<script type="application/json" id="daily-fact">
    $output
</script>
<script defer src="./scripts/index.js"></script>
<link rel="stylesheet" href="./styles/styles.css">
EOF

        echo "[$timestamp] Output saved to $OUTPUT_FILE"

        # Commit and push changes forcefully
        git add "$OUTPUT_FILE"
        git commit -m "Update daily fact generated on $timestamp"
        echo "Pushing changes to git..."
        git push --force

        exit 0
    fi
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failed after $MAX_RETRIES attempts."
exit 1
