package vpws

import (
	"mpls-l2vpn-simulator/pkg/calibration"
	"mpls-l2vpn-simulator/pkg/lsping"
	"mpls-l2vpn-simulator/pkg/mpls"
	"mpls-l2vpn-simulator/pkg/pw"
	"sync"
	"time"
)

type PERouter struct {
	sync.Mutex
	ID           string
	PWs          map[uint32]*pw.Pseudowire
	LabelMap     map[mpls.Label]*pw.Pseudowire
	PingSessions map[uint32]*lsping.PingSession
	PingResults  map[uint32][]lsping.LSPPingResult
	CalProfiles  map[uint32]*calibration.CalibrationProfile
	RemotePE     *PERouter
}

func NewPERouter(id string) *PERouter {
	return &PERouter{
		ID:           id,
		PWs:          make(map[uint32]*pw.Pseudowire),
		LabelMap:     make(map[mpls.Label]*pw.Pseudowire),
		PingSessions: make(map[uint32]*lsping.PingSession),
		PingResults:  make(map[uint32][]lsping.LSPPingResult),
		CalProfiles:  make(map[uint32]*calibration.CalibrationProfile),
	}
}

func (pe *PERouter) CreateVPWS(pwID uint32, localLabel, remoteLabel mpls.Label) *pw.Pseudowire {
	pe.Lock()
	defer pe.Unlock()

	pseudowire := pw.NewPseudowire(pwID, localLabel, remoteLabel)
	pe.PWs[pwID] = pseudowire
	pe.LabelMap[localLabel] = pseudowire
	pe.CalProfiles[pwID] = calibration.NewCalibrationProfile(pwID)
	return pseudowire
}

func (pe *PERouter) CreateVPWSFEC129(pwID uint32, localLabel, remoteLabel mpls.Label, agi, saii, taii []byte) *pw.Pseudowire {
	pe.Lock()
	defer pe.Unlock()

	pseudowire := pw.NewPseudowireFEC129(pwID, localLabel, remoteLabel, agi, saii, taii)
	pe.PWs[pwID] = pseudowire
	pe.LabelMap[localLabel] = pseudowire
	pe.CalProfiles[pwID] = calibration.NewCalibrationProfile(pwID)
	return pseudowire
}

func (pe *PERouter) GetPW(pwID uint32) (*pw.Pseudowire, bool) {
	pe.Lock()
	defer pe.Unlock()
	p, ok := pe.PWs[pwID]
	return p, ok
}

func (pe *PERouter) GetPWByLabel(label mpls.Label) (*pw.Pseudowire, bool) {
	pe.Lock()
	defer pe.Unlock()
	p, ok := pe.LabelMap[label]
	return p, ok
}

func (pe *PERouter) ListPWs() []*pw.Pseudowire {
	pe.Lock()
	defer pe.Unlock()

	result := make([]*pw.Pseudowire, 0, len(pe.PWs))
	for _, p := range pe.PWs {
		result = append(result, p)
	}
	return result
}

func (pe *PERouter) SetPWStatus(pwID uint32, status pw.PWStatus) bool {
	pe.Lock()
	defer pe.Unlock()

	if p, ok := pe.PWs[pwID]; ok {
		p.SetStatus(status)
		return true
	}
	return false
}

func (pe *PERouter) GetCalProfile(pwID uint32) (*calibration.CalibrationProfile, bool) {
	pe.Lock()
	defer pe.Unlock()
	p, ok := pe.CalProfiles[pwID]
	return p, ok
}

func (pe *PERouter) SetCalProfile(pwID uint32, profile *calibration.CalibrationProfile) {
	pe.Lock()
	defer pe.Unlock()
	pe.CalProfiles[pwID] = profile
}

func (pe *PERouter) CreatePingSession(pwID uint32) (*lsping.PingSession, bool) {
	pe.Lock()
	defer pe.Unlock()

	p, ok := pe.PWs[pwID]
	if !ok {
		return nil, false
	}

	session := lsping.NewPingSession(p)
	pe.PingSessions[pwID] = session
	pe.PingResults[pwID] = make([]lsping.LSPPingResult, 0)
	return session, true
}

func (pe *PERouter) SendLSPPing(pwID uint32, count int) ([]lsping.LSPPingResult, error) {
	pe.Lock()
	session, ok := pe.PingSessions[pwID]
	p, pwOk := pe.PWs[pwID]
	calProfile := pe.CalProfiles[pwID]
	pe.Unlock()

	if !ok {
		var created bool
		session, created = pe.CreatePingSession(pwID)
		if !created {
			return nil, nil
		}
	}

	if !pwOk {
		return nil, nil
	}

	if calProfile == nil {
		calProfile = calibration.NewCalibrationProfile(pwID)
		pe.SetCalProfile(pwID, calProfile)
	}

	results := make([]lsping.LSPPingResult, 0, count)

	for i := 0; i < count; i++ {
		request := session.CreateEchoRequest()

		if calProfile.ShouldDropPacket() {
			results = append(results, lsping.LSPPingResult{
				Success:        false,
				SequenceNumber: request.SequenceNumber,
				RTT:            0,
				ReturnCode:     3,
				ReturnSubcode:  0,
				Error:          "Packet lost (simulated)",
				FECType:        fecTypeStr(p.FECType),
			})
			continue
		}

		var reply *lsping.LSPPingMessage

		if pe.RemotePE != nil && p.IsUp() {
			simDelay := calProfile.SimulateDelay()
			time.Sleep(simDelay)
			reply = pe.RemotePE.ReceiveLSPPing(request)
		} else {
			results = append(results, lsping.LSPPingResult{
				Success:        false,
				SequenceNumber: request.SequenceNumber,
				RTT:            0,
				ReturnCode:     4,
				ReturnSubcode:  1,
				Error:          "PW down or remote PE not connected",
				FECType:        fecTypeStr(p.FECType),
			})
			continue
		}

		if reply != nil {
			result := session.ProcessEchoReply(reply)
			results = append(results, result)
		} else {
			results = append(results, lsping.LSPPingResult{
				Success:        false,
				SequenceNumber: request.SequenceNumber,
				RTT:            0,
				ReturnCode:     3,
				ReturnSubcode:  0,
				Error:          "No reply received",
				FECType:        fecTypeStr(p.FECType),
			})
		}

		if i < count-1 {
			interval := time.Duration(calProfile.PingIntervalMs) * time.Millisecond
			time.Sleep(interval)
		}
	}

	pe.Lock()
	pe.PingResults[pwID] = append(pe.PingResults[pwID], results...)
	pe.Unlock()

	return results, nil
}

func (pe *PERouter) ReceiveLSPPing(request *lsping.LSPPingMessage) *lsping.LSPPingMessage {
	pe.Lock()
	defer pe.Unlock()

	if len(request.TargetFECStack) == 0 {
		return lsping.GenerateErrorReply(request, 1, 1)
	}

	fecElement := request.TargetFECStack[0]

	switch fecElement.Type() {
	case lsping.FECType128:
		return pe.validateFEC128(request, fecElement.FEC128)
	case lsping.FECType129:
		return pe.validateFEC129(request, fecElement.FEC129)
	default:
		return lsping.GenerateErrorReply(request, 1, 1)
	}
}

func (pe *PERouter) validateFEC128(request *lsping.LSPPingMessage, reqFEC *lsping.FEC128) *lsping.LSPPingMessage {
	for _, p := range pe.PWs {
		if p.FECType != pw.FECType128 {
			continue
		}

		pwFEC := &lsping.FEC128{
			PWType: uint16(p.Type),
			PWID:   p.ID,
		}

		if reqFEC.Match(pwFEC) {
			if !p.IsUp() {
				return lsping.GenerateErrorReply(request, 5, 0)
			}
			return lsping.GenerateEchoReply(request)
		}
	}

	return lsping.GenerateErrorReply(request, 4, 2)
}

func (pe *PERouter) validateFEC129(request *lsping.LSPPingMessage, reqFEC *lsping.FEC129) *lsping.LSPPingMessage {
	for _, p := range pe.PWs {
		if p.FECType != pw.FECType129 {
			continue
		}

		pwFEC := &lsping.FEC129{
			PWType: uint16(p.Type),
			AGI:    p.AGI,
			SAII:   p.SAII,
			TAII:   p.TAII,
		}

		if reqFEC.Match(pwFEC) {
			if !p.IsUp() {
				return lsping.GenerateErrorReply(request, 5, 0)
			}
			return lsping.GenerateEchoReply(request)
		}

		crossFEC := &lsping.FEC129{
			PWType: reqFEC.PWType,
			AGI:    p.AGI,
			SAII:   p.TAII,
			TAII:   p.SAII,
		}

		if reqFEC.Match(crossFEC) {
			if !p.IsUp() {
				return lsping.GenerateErrorReply(request, 5, 0)
			}
			return lsping.GenerateEchoReply(request)
		}
	}

	return lsping.GenerateErrorReply(request, 4, 2)
}

func (pe *PERouter) GetPingResults(pwID uint32) []lsping.LSPPingResult {
	pe.Lock()
	defer pe.Unlock()

	if results, ok := pe.PingResults[pwID]; ok {
		return results
	}
	return nil
}

func (pe *PERouter) ClearPingResults(pwID uint32) {
	pe.Lock()
	defer pe.Unlock()

	if _, ok := pe.PingResults[pwID]; ok {
		pe.PingResults[pwID] = make([]lsping.LSPPingResult, 0)
	}
}

func fecTypeStr(t pw.FECType) string {
	switch t {
	case pw.FECType129:
		return "FEC129"
	default:
		return "FEC128"
	}
}
