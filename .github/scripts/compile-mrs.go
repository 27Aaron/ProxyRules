package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/metacubex/meta-rules-converter/output/meta"
)

func main() {
	behavior := flag.String("behavior", "", "Mihomo rule behavior")
	inputPath := flag.String("input", "", "input text rule set")
	outputPath := flag.String("output", "", "output MRS file")
	flag.Parse()

	if *behavior == "" || *inputPath == "" || *outputPath == "" {
		fmt.Fprintln(os.Stderr, "behavior, input, and output are required")
		os.Exit(2)
	}
	input, err := os.ReadFile(*inputPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := meta.SaveMetaRuleSet(input, *behavior, "text", *outputPath); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
