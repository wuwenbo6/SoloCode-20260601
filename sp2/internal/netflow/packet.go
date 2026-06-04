package netflow

type PacketHeader struct {
	Version   uint16
	Count     uint16
	SysUptime uint32
	UNIXSecs  uint32
	Sequence  uint32
	SourceID  uint32
}

type FlowSetHeader struct {
	FlowSetID uint16
	Length    uint16
}

type TemplateFlowSet struct {
	FlowSetHeader
	Templates []TemplateRecord
}

type TemplateRecord struct {
	TemplateID uint16
	FieldCount uint16
	Fields     []FieldSpecifier
}

type FieldSpecifier struct {
	Type             uint16
	Length           uint16
	EnterpriseNumber uint32
	IsEnterprise     bool
}

type DataFlowSet struct {
	FlowSetHeader
	Records [][]byte
}

type Packet struct {
	Header       PacketHeader
	TemplateSets []TemplateFlowSet
	DataSets     []DataFlowSet
}
