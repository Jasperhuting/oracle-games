#!/usr/bin/env python3
"""
Debug script to check name extraction and normalization
"""

import re
import os

def normalize_name(name):
    """Normalize rider name to consistent format (Firstname Surname)"""
    name = name.strip()
    
    # If name is in format "SURNAME Firstname", convert to "Firstname Surname"
    if ' ' in name and name[0].isupper():
        parts = name.split(' ', 1)
        if len(parts) == 2:
            # Check if first part looks like a surname (all caps or has multiple uppercase parts)
            first_part = parts[0]
            if (first_part.isupper() or 
                any(part[0].isupper() for part in first_part.split('-')) or
                ' ' in first_part):  # Handle names like "VAN DER POEL"
                # This looks like SURNAME Firstname format
                surname, firstname = parts
                return f"{firstname} {surname}"
    
    return name

def extract_points_from_html(html_content, source_name):
    """Extract rider name and points from HTML content"""
    points_data = {}
    
    # Pattern for main rankings.html (different structure)
    pattern_main = r'data-rider-name="([^"]+)".*?<div class="font-medium text-gray-900">(\d+)</div>'
    
    # Pattern for PCS files (original structure)
    pattern_pcs = r'<tr class=""><td>\d+</td>.*?<a href="rider/([^"]+)">([^<]+)</a>.*?<a href="rider\.php[^>]*>(\d+)</a></td></tr>'
    
    # Try main pattern first
    matches = re.findall(pattern_main, html_content, re.DOTALL)
    
    if matches:
        print(f"Using main pattern for {source_name}")
        for i, match in enumerate(matches[:10]):  # Show first 10
            rider_name, points = match
            original_name = rider_name.strip()
            normalized_name = normalize_name(rider_name)
            print(f"  {i+1}: '{original_name}' -> '{normalized_name}' ({points} points)")
            points_data[normalized_name] = int(points)
    else:
        # Try PCS pattern
        matches = re.findall(pattern_pcs, html_content)
        print(f"Using PCS pattern for {source_name}")
        for i, match in enumerate(matches[:10]):  # Show first 10
            rider_url, rider_name, points = match
            original_name = rider_name.strip()
            normalized_name = normalize_name(rider_name)
            print(f"  {i+1}: '{original_name}' -> '{normalized_name}' ({points} points)")
            points_data[normalized_name] = int(points)
    
    return points_data

def read_file_content(filepath):
    """Read content from a file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"File not found: {filepath}")
        return ""
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return ""

def main():
    base_dir = "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games/app/api/games/[gameId]/teams-overview/"
    
    # Read main rankings.html
    print("=== MAIN RANKINGS ===")
    rankings_html = read_file_content(os.path.join(base_dir, "rankings.html"))
    main_points = extract_points_from_html(rankings_html, "main rankings")
    
    print(f"\n=== PCS RANKINGS (1-100) ===")
    pcs_html = read_file_content(os.path.join(base_dir, "rankings-pcs-1-100.html"))
    pcs_points = extract_points_from_html(pcs_html, "PCS 1-100")
    
    print(f"\n=== COMPARISON ===")
    main_names = set(main_points.keys())
    pcs_names = set(pcs_points.keys())
    
    print(f"Main names (first 10): {list(main_names)[:10]}")
    print(f"PCS names (first 10): {list(pcs_names)[:10]}")
    print(f"Matching names: {len(main_names & pcs_names)}")
    
    if main_names & pcs_names:
        print("Matches found:")
        for name in list(main_names & pcs_names)[:5]:
            print(f"  {name}: Main={main_points[name]}, PCS={pcs_points[name]}")

if __name__ == "__main__":
    main()
