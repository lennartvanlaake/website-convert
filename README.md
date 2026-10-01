Trick to count filetypes: `find . -type f -name '*.*' -not -name '.*' | sed -Ee 's,.*/.+\.([^/]+)$,\1,' | sort | uniq -ci | sort -n`
