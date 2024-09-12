#!/bin/bash

copy_to_file_path="."
version_tag="$1"

echo "version tag: $version_tag"
nargo_file_path="$copy_to_file_path/Nargo.toml"

repo_url="https://github.com/AztecProtocol/aztec-packages.git"
contracts_path="noir-projects/noir-contracts/contracts"

# Check if the file exists
if [ ! -f "$nargo_file_path" ]; then
    echo "File not found: $nargo_file_path"
    exit 1
fi

# Update the tag in the Nargo.toml file
while IFS= read -r line; do
    if [[ $line == *tag=* ]]; then
        # Extract the dependency name for logging purposes
        dependency_name=$(echo $line | grep -oP '(?<=\").+?(?=\")' | head -1)
        # Update the tag
        sed -i "s|\($dependency_name.*tag=\"\)[^\"]*|\1$version_tag|" $nargo_file_path
        echo "Updated tag for $dependency_name to $version_tag"
    fi
done < <(
    sed -n '/^\[dependencies\]/,/^$/p' $nargo_file_path | grep -v '^\[dependencies\]' | awk NF
)

# Extract the value of the 'name' field
name_value=$(grep "^name\s*=" "$nargo_file_path" | sed 's/name\s*=\s*"\(.*\)"/\1/')

# Check if name_value is not empty
if [ -z "$name_value" ]; then
    echo "Name field not found or empty in the TOML file."
else
    echo "The value of the 'name' field is: $name_value"
fi

# Check if this is running as a GitHub action
if [ "$GITHUB_ACTIONS" == "true" ]; then
    tmp_dir="$GITHUB_WORKSPACE/tmp"
else
    tmp_dir="$copy_to_file_path/tmp"
fi

# Clone the repository into a tmp folder
git clone $repo_url $tmp_dir
cd $tmp_dir && git checkout $version_tag && cd ..

# Check if clone was successful
if [ $? -eq 0 ]; then

    # Check if the directory exists
    if [ -d "$tmp_dir/$contracts_path/$name_value" ]; then
        echo "Directory found: $name_value"
        cp -r $tmp_dir/$contracts_path/$name_value/src/ $copy_to_file_path/
        rm -rf $tmp_dir
        echo "Copied the contracts to $copy_to_file_path"
        # You can add additional commands here to handle the directory

        # Remove docs comments from the files
        find "$copy_to_file_path/src" -type f -name "*.nr" | while read file; do
            # Remove lines starting with '// docs:'
            sed -i '/[ \t]*\/\/ docs:.*/d' "$file"

            echo "Comments removed from $file"
        done

        # Add 'mod test;' to the top of main.nr
        main_nr_file="$copy_to_file_path/src/main.nr"
        if [ -f "$main_nr_file" ]; then
            sed -i '1imod test;' "$main_nr_file"
            echo "Added 'mod test;' to the top of main.nr"
        else
            echo "main.nr not found in $copy_to_file_path/src/"
        fi
    else
        echo "Directory not found: $name_value"
    fi
else
    echo "Failed to clone the repository"
fi

rm -rf $tmp_dir
