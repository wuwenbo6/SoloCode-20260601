package mpls

type Label uint32

const (
	LabelImplicitNull Label = 3
	LabelMaxValue     Label = 1048575
)

type LabelStackEntry struct {
	Label    Label
	Exp      uint8
	S        bool
	TTL      uint8
}

type LabelStack []LabelStackEntry

func NewLabelStack() LabelStack {
	return make(LabelStack, 0)
}

func (ls *LabelStack) Push(entry LabelStackEntry) {
	*ls = append(*ls, entry)
}

func (ls *LabelStack) Pop() (LabelStackEntry, bool) {
	if len(*ls) == 0 {
		return LabelStackEntry{}, false
	}
	entry := (*ls)[len(*ls)-1]
	*ls = (*ls)[:len(*ls)-1]
	return entry, true
}

func (ls LabelStack) Top() (LabelStackEntry, bool) {
	if len(ls) == 0 {
		return LabelStackEntry{}, false
	}
	return ls[len(ls)-1], true
}

func (e LabelStackEntry) Encode() uint32 {
	return uint32(e.Label)<<12 | uint32(e.Exp)<<9 | uint32(boolToInt(e.S))<<8 | uint32(e.TTL)
}

func DecodeLabelStackEntry(val uint32) LabelStackEntry {
	return LabelStackEntry{
		Label: Label(val >> 12),
		Exp:   uint8((val >> 9) & 0x7),
		S:     (val>>8)&0x1 == 1,
		TTL:   uint8(val & 0xFF),
	}
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
