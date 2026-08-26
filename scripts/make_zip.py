import os
import zipfile
import shutil

def create_project_zip():
    output_filename = "HALAQI-Android-Project.zip"
    exclude_dirs = {"node_modules", ".git", "dist", ".vite"}
    exclude_files = {output_filename, "package-lock.json.bak"}

    # Ensure public folder exists
    os.makedirs("public", exist_ok=True)
    public_target = os.path.join("public", output_filename)

    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk("."):
            # Modify dirs in-place to skip excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith(".system")]
            
            for file in files:
                if file in exclude_files or file.endswith(".tmp"):
                    continue
                file_path = os.path.join(root, file)
                # Archive name relative to root
                arcname = os.path.relpath(file_path, ".")
                zipf.write(file_path, arcname)
                print(f"Added: {arcname}")

    # Copy to public folder as well so it is directly servable
    shutil.copy(output_filename, public_target)
    print(f"\nSuccessfully generated {output_filename} ({os.path.getsize(output_filename)} bytes)")
    print(f"Copied to {public_target}")

if __name__ == "__main__":
    create_project_zip()
